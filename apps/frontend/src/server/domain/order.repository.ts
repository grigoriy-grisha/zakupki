import { dbClient, deletePurchaseOrderIfNoLines, ensurePurchaseOrder } from '@zakupki/database';
import {
    calcSupplementStockChange,
    getSupplementStockDecrement,
    InsufficientStockError,
    NotFoundError,
    shouldDecrementSupplementStock,
    validateSupplementPackReduction,
} from '@zakupki/types';

import { productWithAttributes } from './purchase.repository';
import { USER_CREDENTIALS_INCLUDE } from './user.types';

export class OrderRepository {
    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return dbClient.$transaction(async (tx) => {
            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: purchaseItemId },
                select: { purchaseId: true },
            });
            if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

            await ensurePurchaseOrder(tx, userId, purchaseItem.purchaseId);

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue },
                create: { purchaseItemId, userId, quantity, amountDue },
                omit: { tgChatMessageId: true },
            });
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
            const oldPacks = existingLine?.supplementPacksAdded ?? 0;
            const delta = quantity - oldQuantity;

            const packSize =
                purchaseItem.product.supplierPackageAmount != null
                    ? Number(purchaseItem.product.supplierPackageAmount)
                    : null;

            // Рассчитываем новое количество защищённых пачек
            let newPacks = oldPacks;
            if (options?.isSupplement && packSize && packSize > 0) {
                if (delta > 0) {
                    // При увеличении: добавляем целые пачки из дельты
                    const packsInDelta = Math.floor((delta + 1e-9) / packSize);
                    newPacks = oldPacks + packsInDelta;
                } else if (delta < 0) {
                    // При уменьшении: валидируем и определяем новое количество пачек
                    const packResult = validateSupplementPackReduction(quantity, oldQuantity, {
                        supplementPacksAdded: oldPacks,
                        packSize,
                    });
                    if (!packResult.valid) {
                        throw new NotFoundError(packResult.error ?? 'Нельзя частично удалить пачку', 0);
                    }
                    newPacks = packResult.newPacks;
                }
            }

            // Списываем/восстанавливаем остаток только при доборе
            if (options?.isSupplement) {
                if (delta !== 0 && purchaseItem.availableQty !== null) {
                    const available = Number(purchaseItem.availableQty);
                    // Используем точный расчёт по свободной части
                    if (packSize && packSize > 0 && oldPacks > 0) {
                        const stockDelta = calcSupplementStockChange(oldQuantity, quantity, oldPacks, newPacks, packSize);
                        if (stockDelta > 0) {
                            // Списываем из остатка
                            const decrement = Math.min(stockDelta, available);
                            if (decrement < stockDelta) {
                                throw new InsufficientStockError(available, quantity);
                            }
                            await tx.purchaseItem.update({
                                where: { id: purchaseItemId },
                                data: { availableQty: available - decrement },
                            });
                        } else if (stockDelta < 0) {
                            // Восстанавливаем в остаток
                            await tx.purchaseItem.update({
                                where: { id: purchaseItemId },
                                data: { availableQty: available + Math.abs(stockDelta) },
                            });
                        }
                    } else if (delta > 0) {
                        // Старая логика для случаев без защищённых пачек
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
                    } else if (delta < 0) {
                        await tx.purchaseItem.update({
                            where: { id: purchaseItemId },
                            data: { availableQty: available + Math.abs(delta) },
                        });
                    }
                }
            }

            await ensurePurchaseOrder(tx, userId, purchaseItem.purchaseId);

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: { quantity, amountDue, supplementPacksAdded: newPacks },
                create: { purchaseItemId, userId, quantity, amountDue, supplementPacksAdded: newPacks },
                omit: { tgChatMessageId: true },
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
                    include: { product: { select: { supplierPackageAmount: true } } },
                });

                if (purchaseItem?.availableQty !== null && purchaseItem) {
                    const available = Number(purchaseItem.availableQty);
                    const qty = Number(line.quantity);
                    const packs = line.supplementPacksAdded;
                    const packSize =
                        purchaseItem.product.supplierPackageAmount != null
                            ? Number(purchaseItem.product.supplierPackageAmount)
                            : 0;
                    // Восстанавливаем только свободную часть (без пачек)
                    const freePortion = packSize > 0 ? qty - packs * packSize : qty;
                    const restoreAmount = Math.max(0, freePortion);
                    if (restoreAmount > 0) {
                        await tx.purchaseItem.update({
                            where: { id: line.purchaseItemId },
                            data: { availableQty: available + restoreAmount },
                        });
                    }
                }
            }

            const purchaseItem = await tx.purchaseItem.findUnique({
                where: { id: line.purchaseItemId },
                select: { purchaseId: true },
            });

            const deleted = await tx.orderLine.delete({
                where: { id },
                omit: { tgChatMessageId: true },
            });

            if (purchaseItem) {
                await deletePurchaseOrderIfNoLines(tx, line.userId, purchaseItem.purchaseId);
            }

            return deleted;
        });
    }

    async deletePurchaseOrder(userId: number, purchaseId: number) {
        return dbClient.purchaseOrder.deleteMany({ where: { userId, purchaseId } });
    }

    findPurchaseOrdersByUser(userId: number) {
        return dbClient.purchaseOrder.findMany({ where: { userId } });
    }

    findPurchaseOrdersByPurchase(purchaseId: number) {
        return dbClient.purchaseOrder.findMany({ where: { purchaseId } });
    }

    async getByUser(userId: number) {
        return dbClient.orderLine.findMany({
            where: { userId },
            omit: { tgChatMessageId: true },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: productWithAttributes },
                        purchase: { select: { id: true, tag: true, supplier: true, fulfillmentStatus: true, status: true } },
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
                    include: { product: { include: productWithAttributes } },
                },
            },
        });
    }

    async delete(id: number) {
        return dbClient.orderLine.delete({
            where: { id },
            omit: { tgChatMessageId: true },
        });
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
