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

        if (data.unitCode !== undefined) {
            await this.syncUnitOnPurchaseItems(id, data.unitCode);
        }

        const linkedItems = await dbClient.purchaseItem.findMany({
            where: { productId: id, tgMessageId: { not: null } },
            select: { id: true },
        });
        await Promise.all(linkedItems.map((it) => this.eventBus.emitPurchaseItemChanged(it.id)));

        return result;
    }

    private async syncUnitOnPurchaseItems(productId: number, unitCode: string) {
        const unit = getUnitByCode(unitCode);
        const shortName = unit?.shortName ?? null;
        if (shortName == null) return;

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
