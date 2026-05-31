import { dbClient } from '@zakupki/database';
import { InsufficientStockError, NotFoundError } from '@zakupki/types';

export class OrderRepository {
    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return dbClient.orderLine.upsert({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            update: { quantity, amountDue },
            create: { purchaseItemId, userId, quantity, amountDue },
        });
    }

    async upsertWithStock(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return dbClient.$transaction(async (tx) => {
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

    async findById(id: number) {
        return dbClient.orderLine.findUnique({ where: { id } });
    }

    async deleteAndRestoreStock(id: number, options?: { throwIfNotFound?: boolean }) {
        return dbClient.$transaction(async (tx) => {
            const line = await tx.orderLine.findUnique({ where: { id } });
            if (!line) {
                if (options?.throwIfNotFound === false) return null;
                throw new NotFoundError('Строка заказа', id);
            }

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

    async getByUser(userId: number) {
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.delete({ where: { id } });
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId },
            include: { user: true },
        });
    }
}
