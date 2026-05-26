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

    async addItem(purchaseId: number, productId: number, priceOverride?: number, minQty?: number) {
        return this.db.purchaseItem.create({
            data: { purchaseId, productId, priceOverride, minQty },
        });
    }

    async removeItem(id: number) {
        return this.db.purchaseItem.delete({ where: { id } });
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
}
