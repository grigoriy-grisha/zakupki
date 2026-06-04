import { dbClient, deletePurchaseOrderIfNoLines, ensurePurchaseOrder } from '@zakupki/database';
import {
    getSupplementStockDecrement,
    InsufficientStockError,
    NotFoundError,
    shouldDecrementSupplementStock,
} from '@zakupki/types';

export class OrderRepository {
    async upsertWithStock(
        purchaseItemId: number,
        userId: number,
        quantity: number,
        amountDue: number,
        options?: { isSupplement?: boolean; tgChatMessageId?: bigint },
    ) {
        return dbClient.$transaction(async (tx) => {
            const existingLine = await tx.orderLine.findUnique({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
            });

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: purchaseItemId },
                include: { product: { select: { supplierPackageAmount: true } } },
            });

            if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

            const oldQuantity = existingLine ? Number(existingLine.quantity) : 0;
            const delta = quantity - oldQuantity;

            // Списываем/восстанавливаем остаток только при доборе
            if (options?.isSupplement) {
                const packSize =
                    purchaseItem.product.supplierPackageAmount != null
                        ? Number(purchaseItem.product.supplierPackageAmount)
                        : null;

                if (delta > 0 && purchaseItem.availableQty !== null) {
                    const available = Number(purchaseItem.availableQty);
                    if (shouldDecrementSupplementStock(quantity, delta, available, packSize)) {
                        const decrement = getSupplementStockDecrement(delta, available);
                        if (decrement < delta) {
                            throw new InsufficientStockError(available, quantity);
                        }
                        await tx.purchaseItem.update({
                            where: { id: purchaseItemId },
                            data: { availableQty: available - decrement },
                        });
                    }
                } else if (delta < 0 && purchaseItem.availableQty !== null) {
                    const available = Number(purchaseItem.availableQty);
                    await tx.purchaseItem.update({
                        where: { id: purchaseItemId },
                        data: { availableQty: available + Math.abs(delta) },
                    });
                }
            }

            const tgChatMessageId = options?.tgChatMessageId;

            await ensurePurchaseOrder(tx, userId, purchaseItem.purchaseId);

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue, ...(tgChatMessageId != null ? { tgChatMessageId } : {}) },
                create: { purchaseItemId, userId, quantity, amountDue, ...(tgChatMessageId != null ? { tgChatMessageId } : {}) },
            });
        });
    }

    findByUserId(userId: number, limit = 10) {
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.findMany({
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
        return dbClient.orderLine.findUnique({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
        });
    }

    deleteAndRestoreStock(id: number, options?: { isSupplement?: boolean }) {
        return dbClient.$transaction(async (tx) => {
            const line = await tx.orderLine.findUnique({ where: { id } });
            if (!line) return null;

            if (options?.isSupplement) {
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
            }

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: line.purchaseItemId },
                select: { purchaseId: true },
            });

            const deleted = await tx.orderLine.delete({ where: { id } });

            if (purchaseItem) {
                await deletePurchaseOrderIfNoLines(tx, line.userId, purchaseItem.purchaseId);
            }

            return deleted;
        });
    }

    findPurchaseOrder(userId: number, purchaseId: number) {
        return dbClient.purchaseOrder.findUnique({
            where: { userId_purchaseId: { userId, purchaseId } },
        });
    }
}
