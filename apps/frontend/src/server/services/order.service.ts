import { calculateOrderAmount } from '@zakupki/types';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';

export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
    ) {}

    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.repo.upsert(purchaseItemId, userId, quantity, amountDue);
    }

    async upsertOrder(purchaseItemId: number, userId: number, quantity: number) {
        const purchaseItem = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!purchaseItem) throw new Error('Purchase item not found');

        const status = purchaseItem.purchase.status as string;
        if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
            throw new Error('Закупка неактивна, заказы не принимаются');
        }

        const amountDue = calculateOrderAmount(quantity, {
            priceTiers: purchaseItem.product.priceTiers,
            pricePerUnit: Number(purchaseItem.product.pricePerUnit),
            priceOverride: purchaseItem.priceOverride != null ? Number(purchaseItem.priceOverride) : null,
        });

        return this.upsertWithStock(purchaseItemId, userId, quantity, amountDue);
    }

    async upsertWithStock(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.repo.upsertWithStock(purchaseItemId, userId, quantity, amountDue);
    }

    async getByUser(userId: number) {
        return this.repo.getByUser(userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }

    async deleteAndRestoreStock(id: number) {
        return this.repo.deleteAndRestoreStock(id);
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return this.repo.getByPurchaseItem(purchaseItemId);
    }
}
