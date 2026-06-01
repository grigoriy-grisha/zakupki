import { dbClient } from '@zakupki/database';
import { InsufficientStockError, NotFoundError } from '@zakupki/types';

const db = dbClient;

export class OrderRepository {
    async upsertWithStock(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return db.$transaction(async (tx) => {
            const existingLine = await tx.orderLine.findUnique({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
            });

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: purchaseItemId },
            });

            if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

            const oldQuantity = existingLine ? Number(existingLine.quantity) : 0;
            const delta = quantity - oldQuantity;

            if (delta > 0 && purchaseItem.availableQty !== null) {
                const available = Number(purchaseItem.availableQty);
                if (available < delta) {
                    throw new InsufficientStockError(available, quantity);
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

    findByUserId(userId: number, limit = 10) {
        return db.orderLine.findMany({
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

    findAllByUserId(userId: number) {
        return db.orderLine.findMany({
            where: { userId },
            select: {
                amountDue: true,
                purchaseItem: {
                    select: {
                        purchaseId: true,
                        purchase: { select: { id: true, tag: true } },
                    },
                },
            },
        });
    }

    findActiveOrdersByUserId(userId: number) {
        return db.orderLine.findMany({
            where: {
                userId,
                purchaseItem: {
                    purchase: { status: { in: ['ACTIVE', 'SUPPLEMENT'] } },
                },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: { unit: true } },
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    findByUserAndPurchase(userId: number, purchaseId: number) {
        return db.orderLine.findMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: { unit: true } },
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    findByPurchaseItemAndUser(purchaseItemId: number, userId: number) {
        return db.orderLine.findUnique({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
        });
    }

    deleteAndRestoreStock(id: number) {
        return db.$transaction(async (tx) => {
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
