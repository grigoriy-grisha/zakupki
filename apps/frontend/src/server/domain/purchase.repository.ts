import type { PrismaClient } from '@zakupki/database';

export class PurchaseRepository {
    constructor(private db: PrismaClient) {}

    async list(status?: string) {
        return this.db.purchase.findMany({
            where: status ? { status: status as any } : undefined,
            include: {
                items: {
                    include: {
                        product: { include: { photos: { select: { id: true } }, unit: true } },
                        orderLines: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listByStatuses(statuses: string[]) {
        return this.db.purchase.findMany({
            where: { status: { in: statuses as any } },
            include: {
                items: {
                    include: {
                        product: { include: { photos: { select: { id: true } }, unit: true } },
                        orderLines: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return this.db.purchase.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { include: { photos: { select: { id: true } }, unit: true } },
                        orderLines: { include: { user: true } },
                    },
                },
                payments: { include: { user: true } },
            },
        });
    }

    async create(data: { tag: string; supplier: string; minAmount: number; deadline: Date }) {
        return this.db.purchase.create({ data });
    }

    async updateStatus(id: number, status: string) {
        return this.db.purchase.update({ where: { id }, data: { status: status as any } });
    }

    async findProductIdsInPurchase(purchaseId: number, productIds: number[]) {
        if (productIds.length === 0) return [];
        const rows = await this.db.purchaseItem.findMany({
            where: { purchaseId, productId: { in: productIds } },
            select: { productId: true },
        });
        return rows.map((row) => row.productId);
    }

    async addItem(purchaseId: number, productId: number, shouldPublish = false) {
        return this.db.purchaseItem.create({
            data: { purchaseId, productId, shouldPublish },
        });
    }

    async removeItem(id: number) {
        return this.db.$transaction(async (tx) => {
            await tx.orderLine.deleteMany({ where: { purchaseItemId: id } });
            return tx.purchaseItem.delete({ where: { id } });
        });
    }

    async updateTgMessage(purchaseItemId: number, tgMessageId: string, tgChannelId: string) {
        return this.db.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { tgMessageId, tgChannelId },
        });
    }

    async setAvailableQuantities(purchaseId: number, items: { purchaseItemId: number; availableQty: number | null }[]) {
        const updates = items.map((item) =>
            this.db.purchaseItem.update({
                where: { id: item.purchaseItemId },
                data: { availableQty: item.availableQty },
            }),
        );
        return Promise.all(updates);
    }

    async findUnpublishedItems(purchaseId: number) {
        return this.db.purchaseItem.findMany({
            where: { purchaseId, shouldPublish: true, tgMessageId: null },
            select: { id: true },
        });
    }

    async toggleShouldPublish(purchaseItemId: number, value: boolean) {
        return this.db.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { shouldPublish: value },
        });
    }

    async findItemById(id: number) {
        return this.db.purchaseItem.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    async findItemWithProductAndTg(id: number) {
        return this.db.purchaseItem.findUnique({
            where: { id },
            select: { productId: true, tgMessageId: true, tgChannelId: true },
        });
    }

    async findItemWithPrice(id: number) {
        return this.db.purchaseItem.findUnique({
            where: { id },
            include: { product: true, purchase: true },
        });
    }
}
