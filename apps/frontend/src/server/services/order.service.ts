import { calculateOrderAmount, ForbiddenError, NotFoundError, PurchaseNotActiveError } from '@zakupki/types';

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
        if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

        const status = purchaseItem.purchase.status as string;
        if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
            throw new PurchaseNotActiveError(status);
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

    /** Admin-only: delete without ownership check */
    async delete(id: number) {
        return this.repo.delete(id);
    }

    /** Delete with ownership verification — only the order's owner can cancel */
    async deleteAndRestoreStock(id: number, userId: number, options?: { throwIfNotFound?: boolean }) {
        const line = await this.repo.findById(id);
        if (!line) {
            if (options?.throwIfNotFound) throw new NotFoundError('Строка заказа', id);
            return null;
        }
        if (line.userId !== userId) {
            throw new ForbiddenError('Нельзя удалить чужой заказ');
        }
        return this.repo.deleteAndRestoreStock(id, options as any);
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return this.repo.getByPurchaseItem(purchaseItemId);
    }
}
