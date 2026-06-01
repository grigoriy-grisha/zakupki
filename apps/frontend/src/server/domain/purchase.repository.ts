import { dbClient } from '@zakupki/database';

const productWithAttributes = {
    photos: { select: { id: true, sortOrder: true } },
    unit: true,
    brand: { select: { id: true, name: true, typeId: true, showInTitle: true, isBrand: true } },
    attributeValues: {
        include: {
            attribute: {
                include: {
                    type: true,
                    parent: { select: { id: true, name: true, isBrand: true } },
                    characteristics: { include: { characteristic: true } },
                },
            },
        },
    },
    characteristicValues: { include: { characteristic: true }, orderBy: [{ sortOrder: 'asc' }, { characteristicId: 'asc' }] },
} as const;

export class PurchaseRepository {
    constructor() {}

    async list(status?: string) {
        return dbClient.purchase.findMany({
            where: status ? { status: status as any } : undefined,
            include: {
                items: {
                    include: {
                        product: { include: productWithAttributes },
                        orderLines: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listByStatuses(statuses: string[]) {
        return dbClient.purchase.findMany({
            where: { status: { in: statuses as any } },
            include: {
                items: {
                    include: {
                        product: { include: productWithAttributes },
                        orderLines: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listByStatusesForUser(userId: number, statuses: string[]) {
        return dbClient.purchase.findMany({
            where: {
                status: { in: statuses as any },
                items: { some: { orderLines: { some: { userId } } } },
            },
            include: {
                items: {
                    include: {
                        product: { include: productWithAttributes },
                        orderLines: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.purchase.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { include: productWithAttributes },
                        orderLines: { include: { user: true } },
                    },
                },
                payments: { include: { user: true } },
            },
        });
    }

    async create(data: { tag: string; supplier: string; minAmount: number; deadline: Date }) {
        return dbClient.purchase.create({ data });
    }

    async updateStatus(id: number, status: string) {
        return dbClient.purchase.update({ where: { id }, data: { status: status as any } });
    }

    async updateFulfillmentStatus(id: number, fulfillmentStatus: string) {
        return dbClient.purchase.update({
            where: { id },
            data: { fulfillmentStatus: fulfillmentStatus as any },
        });
    }

    async deleteDraft(id: number) {
        return dbClient.$transaction(async (tx) => {
            const purchase = await tx.purchase.findUnique({ where: { id }, select: { status: true } });
            if (!purchase) return null;

            const items = await tx.purchaseItem.findMany({
                where: { purchaseId: id },
                select: { id: true },
            });
            const itemIds = items.map((i) => i.id);
            if (itemIds.length > 0) {
                await tx.orderLine.deleteMany({ where: { purchaseItemId: { in: itemIds } } });
                await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
            }

            const payments = await tx.payment.findMany({
                where: { purchaseId: id },
                select: { id: true },
            });
            const paymentIds = payments.map((p) => p.id);
            if (paymentIds.length > 0) {
                await tx.payment.deleteMany({ where: { parentId: { in: paymentIds } } });
                await tx.payment.deleteMany({ where: { purchaseId: id } });
            }

            await tx.promoCode.updateMany({ where: { purchaseId: id }, data: { purchaseId: null } });
            return tx.purchase.delete({ where: { id } });
        });
    }

    async findProductIdsInPurchase(purchaseId: number, productIds: number[]) {
        if (productIds.length === 0) return [];
        const rows = await dbClient.purchaseItem.findMany({
            where: { purchaseId, productId: { in: productIds } },
            select: { productId: true },
        });
        return rows.map((row) => row.productId);
    }

    async addItem(purchaseId: number, productId: number, shouldPublish = false) {
        return dbClient.purchaseItem.create({
            data: { purchaseId, productId, shouldPublish },
        });
    }

    async findItemWithPurchase(purchaseItemId: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id: purchaseItemId },
            select: {
                id: true,
                tgMessageId: true,
                tgChannelId: true,
                purchase: { select: { status: true, tag: true, fulfillmentStatus: true } },
            },
        });
    }

    async removeItem(id: number) {
        return dbClient.$transaction(async (tx) => {
            await tx.orderLine.deleteMany({ where: { purchaseItemId: id } });
            return tx.purchaseItem.delete({ where: { id } });
        });
    }

    async updateTgMessage(purchaseItemId: number, tgMessageId: string, tgChannelId: string) {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { tgMessageId, tgChannelId },
        });
    }

    async setAvailableQuantities(purchaseId: number, items: { purchaseItemId: number; availableQty: number | null }[]) {
        const updates = items.map((item) =>
            dbClient.purchaseItem.update({
                where: { id: item.purchaseItemId },
                data: { availableQty: item.availableQty },
            }),
        );
        return Promise.all(updates);
    }

    async findUnpublishedItems(purchaseId: number) {
        return dbClient.purchaseItem.findMany({
            where: { purchaseId, shouldPublish: true, tgMessageId: null },
            select: { id: true },
        });
    }

    async toggleShouldPublish(purchaseItemId: number, value: boolean) {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { shouldPublish: value },
        });
    }

    async findItemById(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    async findItemWithProductAndTg(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            select: { productId: true, tgMessageId: true, tgChannelId: true },
        });
    }

    async findItemWithPrice(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: { include: { unit: true } },
                orderLines: { select: { quantity: true } },
                purchase: true,
            },
        });
    }
}
