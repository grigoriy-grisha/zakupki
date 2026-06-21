import { NotFoundError } from '@zakupki/types';
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
