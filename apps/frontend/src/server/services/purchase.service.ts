import { PurchaseRepository } from '../domain/purchase.repository';

export class PurchaseService {
    constructor(private repo: PurchaseRepository) {}

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

    async addItems(purchaseId: number, productIds: number[]) {
        const items = [];
        for (const productId of productIds) {
            const item = await this.repo.addItem(purchaseId, productId);
            items.push(item);
        }
        return items;
    }

    async removeItem(id: number) {
        return this.repo.removeItem(id);
    }

    async setAvailableQuantities(purchaseId: number, items: { purchaseItemId: number; availableQty: number | null }[]) {
        return this.repo.setAvailableQuantities(purchaseId, items);
    }
}
