import { TRPCError } from '@trpc/server';
import { PurchaseRepository } from '../domain/purchase.repository';
import { ProductRepository } from '../domain/product.repository';

export class PurchaseService {
    constructor(
        private repo: PurchaseRepository,
        private productRepo: ProductRepository,
    ) {}

    async list(status?: string) {
        return this.repo.list(status);
    }

    async listByStatuses(statuses: string[]) {
        return this.repo.listByStatuses(statuses);
    }

    async getById(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new Error('Purchase not found');
        return purchase;
    }

    async create(data: { tag: string; supplier: string; minAmount: number; deadline: Date }) {
        return this.repo.create(data);
    }

    async updateStatus(id: number, status: string) {
        return this.repo.updateStatus(id, status);
    }

    async activateAndPublish(purchaseId: number) {
        await this.repo.updateStatus(purchaseId, 'ACTIVE');
        return this.repo.findUnpublishedItems(purchaseId);
    }

    async toggleShouldPublish(purchaseItemId: number, value: boolean) {
        return this.repo.toggleShouldPublish(purchaseItemId, value);
    }

    async ensureItemExists(purchaseItemId: number) {
        const item = await this.repo.findItemById(purchaseItemId);
        if (!item) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
        }
    }

    async updateItemProduct(purchaseItemId: number, productData: Record<string, unknown>) {
        const item = await this.repo.findItemWithProductAndTg(purchaseItemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });

        await this.productRepo.update(item.productId, productData as any);
        return item;
    }

    async addItems(purchaseId: number, productIds: number[], shouldPublish = false) {
        const uniqueIds = [...new Set(productIds)];
        const alreadyInPurchase = await this.repo.findProductIdsInPurchase(purchaseId, uniqueIds);
        const alreadySet = new Set(alreadyInPurchase);
        const newProductIds = uniqueIds.filter((id) => !alreadySet.has(id));

        if (newProductIds.length === 0) {
            return { items: [], skippedCount: uniqueIds.length };
        }

        const items = [];
        for (const productId of newProductIds) {
            const item = await this.repo.addItem(purchaseId, productId, shouldPublish);
            items.push(item);
        }
        return { items, skippedCount: uniqueIds.length - newProductIds.length };
    }

    async removeItem(id: number) {
        return this.repo.removeItem(id);
    }

    async setAvailableQuantities(purchaseId: number, items: { purchaseItemId: number; availableQty: number | null }[]) {
        return this.repo.setAvailableQuantities(purchaseId, items);
    }

    async findItemWithPrice(purchaseItemId: number) {
        return this.repo.findItemWithPrice(purchaseItemId);
    }
}
