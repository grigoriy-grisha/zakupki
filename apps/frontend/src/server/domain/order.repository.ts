import type { PrismaClient } from '@zakupki/database';

export class OrderRepository {
    constructor(private db: PrismaClient) {}

    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.db.orderLine.upsert({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            update: { quantity, amountDue },
            create: { purchaseItemId, userId, quantity, amountDue },
        });
    }

    async upsertWithStock(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.db.$transaction(async (tx) => {
            // Get current order line if exists
            const existingLine = await tx.orderLine.findUnique({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
            });

            // Get purchase item with availableQty
            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: purchaseItemId },
            });

            if (!purchaseItem) throw new Error('Purchase item not found');

            const oldQuantity = existingLine ? Number(existingLine.quantity) : 0;
            const delta = quantity - oldQuantity;

            // If increasing order and availableQty is set, check & decrement
            if (delta > 0 && purchaseItem.availableQty !== null) {
                const available = Number(purchaseItem.availableQty);
                if (available < delta) {
                    throw new Error(`Свободный остаток: ${available}. Нельзя заказать ${quantity}`);
                }
                await tx.purchaseItem.update({
                    where: { id: purchaseItemId },
                    data: { availableQty: available - delta },
                });
            } else if (delta < 0 && purchaseItem.availableQty !== null) {
                // If decreasing order, restore stock
                const available = Number(purchaseItem.availableQty);
                await tx.purchaseItem.update({
                    where: { id: purchaseItemId },
                    data: { availableQty: available + Math.abs(delta) },
                });
            }

            // Upsert the order line
            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue },
                create: { purchaseItemId, userId, quantity, amountDue },
            });
        });
    }

    async deleteAndRestoreStock(id: number) {
        return this.db.$transaction(async (tx) => {
            const line = await tx.orderLine.findUnique({ where: { id } });
            if (!line) throw new Error('Order line not found');

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: line.purchaseItemId },
            });

            // Restore stock if availableQty is set
            if (purchaseItem?.availableQty !== null && purchaseItem) {
                const available = Number(purchaseItem.availableQty);
                const qty = Number(line.quantity);
                await tx.purchaseItem.update({
                    where: { id: line.purchaseItemId },
                    data: { availableQty: available + qty },
                });
            }

            return tx.orderLine.delete({ where: { id } });
        });
    }

    async getByUser(userId: number) {
        return this.db.orderLine.findMany({
            where: { userId },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: { unit: true } },
                        purchase: { select: { id: true, tag: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByPurchase(purchaseId: number) {
        return this.db.orderLine.findMany({
            where: { purchaseItem: { purchaseId } },
            include: {
                user: true,
                purchaseItem: {
                    include: { product: { include: { unit: true } } },
                },
            },
        });
    }

    async delete(id: number) {
        return this.db.orderLine.delete({ where: { id } });
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return this.db.orderLine.findMany({
            where: { purchaseItemId },
            include: { user: true },
        });
    }
}
