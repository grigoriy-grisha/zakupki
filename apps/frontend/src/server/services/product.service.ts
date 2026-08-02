import { getUnitByCode, NotFoundError } from '@zakupki/types';
import { dbClient } from '@zakupki/database';

import { ProductRepository, type ProductCreateData, type ProductWriteData } from '../domain/product.repository';
import type { EventBus } from '@zakupki/queue';

export class ProductService {
    constructor(
        private repo: ProductRepository,
        private eventBus: EventBus,
    ) {}

    async list(search?: string) {
        return this.repo.listWithPurchaseFlag(search);
    }

    async getById(id: number) {
        const product = await this.repo.getByIdOrThrow(id);
        if (!product) throw new NotFoundError('Товар', id);
        return product;
    }

    async create(data: ProductCreateData) {
        return this.repo.create(data);
    }

    async update(id: number, data: ProductWriteData) {
        const result = await this.repo.update(id, data);

        // При смене unitCode товара синхронизируем единицы фасовки/лимита на
        // связанных позициях закупок. Раньше minPackageUnit/supplierLimitUnit
        // оставались со старой единицей (напр. «шт» при смене на gram), из-за
        // чего хинты показывали рассогласованный текст («от N шт» при «гр»).
        if (data.unitCode !== undefined) {
            await this.syncUnitOnPurchaseItems(id, data.unitCode);
        }

        // Emit в шину: найти все PurchaseItem с этим Product, у которых УЖЕ есть пост
        // в канале (tgMessageId != null), и обновить их. Дедуп по `pi:<id>` сольёт
        // несколько emit'ов в одно обновление в течение debounce-окна.
        const linkedItems = await dbClient.purchaseItem.findMany({
            where: { productId: id, tgMessageId: { not: null } },
            select: { id: true },
        });
        await Promise.all(linkedItems.map((it) => this.eventBus.emitPurchaseItemChanged(it.id)));

        return result;
    }

    /**
     * Приводит minPackageUnit/supplierLimitUnit/packUnit связанных PurchaseItem
     * к новой единице товара (Product.unitCode).
     *
     * Обновляет только те позиции, где юнит отличается от нового shortName.
     * Сам шаг числом (minPackageAmount, supplementStep) НЕ трогается — только
     * единица измерения. Это чинит косметический баг «от N шт» при смене на gram.
     */
    private async syncUnitOnPurchaseItems(productId: number, unitCode: string) {
        const unit = getUnitByCode(unitCode);
        const shortName = unit?.shortName ?? null;
        if (shortName == null) return;

        // Берём ВСЕ связанные позиции (не только с tgMessageId) — юнит нужно
        // синхронизировать везде, т.к. он влияет на shop UI и хинты.
        const items = await dbClient.purchaseItem.findMany({
            where: { productId },
            select: {
                id: true,
                minPackageUnit: true,
                supplierLimitUnit: true,
                packUnit: true,
            },
        });

        for (const item of items) {
            const needUpdateMinPkg = item.minPackageUnit != null && item.minPackageUnit !== shortName;
            const needUpdateSupplier = item.supplierLimitUnit != null && item.supplierLimitUnit !== shortName;
            const needUpdatePack = item.packUnit != null && item.packUnit !== shortName;

            if (!needUpdateMinPkg && !needUpdateSupplier && !needUpdatePack) continue;

            await dbClient.purchaseItem.update({
                where: { id: item.id },
                data: {
                    ...(needUpdateMinPkg ? { minPackageUnit: shortName } : {}),
                    ...(needUpdateSupplier ? { supplierLimitUnit: shortName } : {}),
                    ...(needUpdatePack ? { packUnit: shortName } : {}),
                },
            });
        }
    }

    async updateWithVersionCheck(id: number, data: ProductWriteData, expectedVersion: number) {
        return this.repo.updateWithVersionCheck(id, data, expectedVersion);
    }

    async delete(id: number) {
        await this.repo.assertNotInActivePurchase(id);
        return this.repo.delete(id);
    }

    async addPhoto(productId: number, objectKey: string, mimeType: string, sortOrder: number) {
        return this.repo.addPhoto(productId, objectKey, mimeType, sortOrder);
    }

    async getPhoto(id: number) {
        return this.repo.getPhoto(id);
    }

    async deletePhoto(id: number) {
        return this.repo.deletePhoto(id);
    }
}
