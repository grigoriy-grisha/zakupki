import { OrderRepository } from '../domain/order.repository';

export class OrderService {
    constructor(private repo: OrderRepository) {}

    async upsert(purchaseItemId: number, userId: number, quantity: number, pricePerUnit: number) {
        const amountDue = quantity * pricePerUnit;
        return this.repo.upsert(purchaseItemId, userId, quantity, amountDue);
    }

    async upsertWithStock(purchaseItemId: number, userId: number, quantity: number, pricePerUnit: number) {
        const amountDue = quantity * pricePerUnit;
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
