import type { PrismaClient } from '@zakupki/database';

export class OrderRepository {
    private db: PrismaClient;

    constructor(db: PrismaClient) {
        this.db = db;
    }

    findByUserId(userId: number, limit = 10) {
        return this.db.orderLine.findMany({
            where: { userId },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: { unit: true } },
                        purchase: { select: { tag: true, supplier: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    upsertWithStock(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.db.$transaction(async (tx) => {
            const existingLine = await tx.orderLine.findUnique({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
            });

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: purchaseItemId },
            });

            if (!purchaseItem) throw new Error('Purchase item not found');

            const oldQuantity = existingLine ? Number(existingLine.quantity) : 0;
            const delta = quantity - oldQuantity;

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
                const available = Number(purchaseItem.availableQty);
                await tx.purchaseItem.update({
                    where: { id: purchaseItemId },
                    data: { availableQty: available + Math.abs(delta) },
                });
            }

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue },
                create: { purchaseItemId, userId, quantity, amountDue },
            });
        });
    }

    findByPurchaseItemAndUser(purchaseItemId: number, userId: number) {
        return this.db.orderLine.findUnique({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
        });
    }

    deleteAndRestoreStock(id: number) {
        return this.db.$transaction(async (tx) => {
            const line = await tx.orderLine.findUnique({ where: { id } });
            if (!line) return null;

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: line.purchaseItemId },
            });

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
}
