import { dbClient, deletePurchaseOrderIfNoLines, ensurePurchaseOrder } from '@zakupki/database';
import {
    calcSupplementStockChange,
    getSupplementStockDecrement,
    InsufficientStockError,
    NotFoundError,
    shouldDecrementSupplementStock,
    validateSupplementPackReduction,
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
                    const packsInDelta = Math.floor((delta + 1e-9) / packSize);
                    newPacks = oldPacks + packsInDelta;
                } else if (delta < 0) {
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
                    if (packSize && packSize > 0 && oldPacks > 0) {
                        const stockDelta = calcSupplementStockChange(
                            oldQuantity,
                            quantity,
                            oldPacks,
                            newPacks,
                            packSize,
                        );
                        if (stockDelta > 0) {
                            const decrement = Math.min(stockDelta, available);
                            if (decrement < stockDelta) {
                                throw new InsufficientStockError(available, quantity);
                            }
                            await tx.purchaseItem.update({
                                where: { id: purchaseItemId },
                                data: { availableQty: available - decrement },
                            });
                        } else if (stockDelta < 0) {
                            await tx.purchaseItem.update({
                                where: { id: purchaseItemId },
                                data: { availableQty: available + Math.abs(stockDelta) },
                            });
                        }
                    } else if (delta > 0) {
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

            const tgChatMessageId = options?.tgChatMessageId;

            await ensurePurchaseOrder(tx, userId, purchaseItem.purchaseId);

            return tx.orderLine.upsert({
                where: { purchaseItemId_userId: { purchaseItemId, userId } },
                update: {
                    quantity,
                    amountDue,
                    supplementPacksAdded: newPacks,
                    ...(tgChatMessageId != null ? { tgChatMessageId } : {}),
                },
                create: {
                    purchaseItemId,
                    userId,
                    quantity,
                    amountDue,
                    supplementPacksAdded: newPacks,
                    ...(tgChatMessageId != null ? { tgChatMessageId } : {}),
                },
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
