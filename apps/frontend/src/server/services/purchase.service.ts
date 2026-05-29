import { TRPCError } from '@trpc/server';
import { PurchaseRepository } from '../domain/purchase.repository';
import { ProductRepository } from '../domain/product.repository';
import { assertCanRemoveFromActivePurchase } from '../domain/product-purchase-lock';

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

    async listByStatusesForUser(userId: number, statuses: string[]) {
        return this.repo.listByStatusesForUser(userId, statuses);
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

    async activate(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        if (purchase.status !== 'DRAFT') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Активировать можно только черновик',
            });
        }
        return this.repo.updateStatus(purchaseId, 'ACTIVE');
    }

    async findItemsToPublish(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        if (purchase.status !== 'ACTIVE') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Публиковать в Telegram можно только для активной закупки',
            });
        }
        return this.repo.findUnpublishedItems(purchaseId);
    }

    async complete(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        if (purchase.status !== 'ACTIVE' && purchase.status !== 'SUPPLEMENT') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Завершить можно только активную закупку или добор',
            });
        }
        return this.repo.updateStatus(id, 'DONE');
    }

    async deleteDraft(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        if (purchase.status !== 'DRAFT') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Удалить можно только черновик',
            });
        }
        const deleted = await this.repo.deleteDraft(id);
        if (!deleted) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        return deleted;
    }

    async toggleShouldPublish(purchaseItemId: number, value: boolean) {
        const item = await this.repo.findItemWithPurchase(purchaseItemId);
        if (!item) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
        }
        if (item.tgMessageId) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Нельзя изменить флаг публикации для уже опубликованного товара',
            });
        }
        if (item.purchase.status === 'DONE') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Нельзя изменить флаг публикации в завершённой закупке',
            });
        }
        return this.repo.toggleShouldPublish(purchaseItemId, value);
    }

    async ensureCanPublishItem(purchaseItemId: number) {
        const item = await this.repo.findItemWithPurchase(purchaseItemId);
        if (!item) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
        }
        if (item.purchase.status !== 'ACTIVE') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Публиковать в Telegram можно только для активной закупки',
            });
        }
        if (item.tgMessageId) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Товар уже опубликован в Telegram',
            });
        }
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
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Закупка не найдена' });
        }
        if (purchase.status === 'DONE') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'В завершённую закупку нельзя добавлять товары',
            });
        }

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
        const item = await this.repo.findItemWithPurchase(id);
        if (!item) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
        }
        assertCanRemoveFromActivePurchase(item.purchase.status, item.purchase.tag, item.tgMessageId);
        return this.repo.removeItem(id);
    }

    async setAvailableQuantities(purchaseId: number, items: { purchaseItemId: number; availableQty: number | null }[]) {
        return this.repo.setAvailableQuantities(purchaseId, items);
    }

    async findItemWithPrice(purchaseItemId: number) {
        return this.repo.findItemWithPrice(purchaseItemId);
    }
}
