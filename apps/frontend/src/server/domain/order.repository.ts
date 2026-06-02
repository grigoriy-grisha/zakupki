import { dbClient } from '@zakupki/database';
import {
    getSupplementStockDecrement,
    InsufficientStockError,
    NotFoundError,
    shouldDecrementSupplementStock,
} from '@zakupki/types';

import { USER_CREDENTIALS_INCLUDE } from './user.types';

export class OrderRepository {
    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return dbClient.orderLine.upsert({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            update: { quantity, amountDue },
            create: { purchaseItemId, userId, quantity, amountDue },
        });
    }

    async upsertWithStock(
        purchaseItemId: number,
        userId: number,
        quantity: number,
        amountDue: number,
        options?: { isSupplement?: boolean },
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

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue },
                create: { purchaseItemId, userId, quantity, amountDue },
            });
        });
    }

    async findById(id: number) {
        return dbClient.orderLine.findUnique({
            where: { id },
            include: { purchaseItem: { include: { purchase: { select: { status: true, fulfillmentStatus: true } } } } },
        });
    }

    findByPurchaseItemAndUser(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findUnique({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
        });
    }

    async deleteAndRestoreStock(id: number, options?: { throwIfNotFound?: boolean; isSupplement?: boolean }) {
        return dbClient.$transaction(async (tx) => {
            const line = await tx.orderLine.findUnique({ where: { id } });
            if (!line) {
                if (options?.throwIfNotFound === false) return null;
                throw new NotFoundError('Строка заказа', id);
            }

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

            return tx.orderLine.delete({ where: { id } });
        });
    }

    async getByUser(userId: number) {
        return dbClient.orderLine.findMany({
            where: { userId },
            omit: { tgChatMessageId: true },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: { unit: true } },
                        purchase: { select: { id: true, tag: true, supplier: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByPurchase(purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId } },
            omit: { tgChatMessageId: true },
            include: {
                user: { include: USER_CREDENTIALS_INCLUDE },
                purchaseItem: {
                    include: { product: { include: { unit: true } } },
                },
            },
        });
    }

    async delete(id: number) {
        return dbClient.orderLine.delete({ where: { id } });
    }

    async findByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
            omit: { tgChatMessageId: true },
            include: {
                purchaseItem: {
                    include: { purchase: { select: { status: true, fulfillmentStatus: true } } },
                },
            },
        });
    }

    async findMessageIdsByUserAndPurchase(userId: number, purchaseId: number): Promise<bigint[]> {
        const lines = await dbClient.orderLine.findMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
                tgChatMessageId: { not: null },
            },
            select: { tgChatMessageId: true },
        });
        return lines.map((l) => l.tgChatMessageId!);
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId },
            omit: { tgChatMessageId: true },
            include: { user: true },
        });
    }
}
