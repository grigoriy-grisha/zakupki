import { dbClient } from '@zakupki/database';
import { NotFoundError } from '@zakupki/types';

import { productInclude } from './product-include';
import { USER_CREDENTIALS_INCLUDE } from './user.types';

export class OrderRepository {
    /**
     * Создать или обновить строку заказа.
     */
    async upsertOrderLine(
        purchaseItemId: number,
        userId: number,
        quantity: number,
        amountDue: number,
        packageCount?: number,
        createdOnStage: string = 'COLLECTION',
    ) {
        const purchaseItem = await dbClient.purchaseItem.findUnique({
            where: { id: purchaseItemId },
            select: { purchaseId: true },
        });
        if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

        // Создаём или обновляем PurchaseOrder
        await dbClient.purchaseOrder.upsert({
            where: { userId_purchaseId: { userId, purchaseId: purchaseItem.purchaseId } },
            create: { userId, purchaseId: purchaseItem.purchaseId },
            update: {},
        });

        const data = { quantity, amountDue, status: 'ACTIVE' as const };
        if (packageCount != null) {
            (data as any).packageCount = packageCount;
        }

        return dbClient.orderLine.upsert({
            where: {
                purchaseItemId_userId_createdOnStage: { purchaseItemId, userId, createdOnStage: createdOnStage as any },
            },
            create: {
                purchaseItemId,
                userId,
                ...data,
                ...(packageCount != null ? { packageCount } : {}),
                createdOnStage: createdOnStage as any,
            },
            update: data,
        });
    }

    /**
     * Удалить строку заказа по id (hard delete).
     */
    async deleteOrderLineById(id: number) {
        return dbClient.orderLine.delete({ where: { id } });
    }

    /**
     * Удалить все строки пользователя для purchaseItem (hard delete — COLLECTION).
     */
    async deleteAllLinesForUserItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.deleteMany({
            where: { purchaseItemId, userId },
        });
    }

    /**
     * Отменить заказ (soft delete).
     */
    async cancelOrder(id: number) {
        return dbClient.orderLine.update({
            where: { id },
            data: { status: 'CANCELLED', quantity: 0, amountDue: 0 },
        });
    }

    /**
     * Hard delete для админа.
     */
    async delete(id: number) {
        return dbClient.orderLine.delete({
            where: { id },
        });
    }

    // ── Queries ──────────────────────────────────────────────────────

    findById(id: number) {
        return dbClient.orderLine.findUnique({
            where: { id },
            include: { purchaseItem: { include: { purchase: { select: { status: true, fulfillmentStatus: true } } } } },
        });
    }

    /**
     * Найти COLLECTION-строку (базовый заказ) пользователя.
     */
    findBaseLine(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findUnique({
            where: {
                purchaseItemId_userId_createdOnStage: { purchaseItemId, userId, createdOnStage: 'COLLECTION' as any },
            },
        });
    }

    /**
     * Найти все ACTIVE строки пользователя для purchaseItem (базовые + supplement).
     */
    findAllActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId, userId, status: 'ACTIVE' },
        });
    }

    findActiveOrdersByUserId(userId: number) {
        return dbClient.orderLine.findMany({
            where: {
                userId,
                status: 'ACTIVE',
                purchaseItem: {
                    purchase: { status: { in: ['ACTIVE'] } },
                },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: true,
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findAllByUserId(userId: number) {
        return dbClient.orderLine.findMany({
            where: { userId },
            include: {
                purchaseItem: {
                    include: {
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
        });
    }

    async getByUser(userId: number) {
        return dbClient.orderLine.findMany({
            where: { userId, status: 'ACTIVE' },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: productInclude },
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByPurchase(purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId }, status: 'ACTIVE' },
            include: {
                user: { include: USER_CREDENTIALS_INCLUDE },
                purchaseItem: {
                    include: { product: { include: productInclude } },
                },
            },
        });
    }

    async findByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: {
                userId,
                status: 'ACTIVE',
                purchaseItem: { purchaseId },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: true,
                        purchase: {
                            select: { id: true, tag: true, supplier: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
        });
    }

    /**
     * Удалить все заказы пользователя в закупке.
     */
    async deleteAllByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.orderLine.deleteMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
        });
    }

    /**
     * Вернуть список PurchaseItem.id, на которые у пользователя есть ACTIVE-строки
     * в данной закупке. Используется OrderService, чтобы эмитить обновление поста
     * после `deleteAllByUserAndPurchase`.
     */
    async findPurchaseItemIdsByUserAndPurchase(userId: number, purchaseId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
            select: { purchaseItemId: true },
            distinct: ['purchaseItemId'],
        });
        return rows.map((r) => r.purchaseItemId);
    }

    /**
     * Заморозить baseQuantity и basePackageCount для COLLECTION-строк закупки
     * (при переходе COLLECTION → REORDER).
     */
    async freezeBaseQuantities(purchaseId: number) {
        const lines = await dbClient.orderLine.findMany({
            where: {
                status: 'ACTIVE',
                baseQuantity: null,
                createdOnStage: 'COLLECTION',
                purchaseItem: { purchaseId },
            },
            select: { id: true, quantity: true, packageCount: true },
        });

        await dbClient.$transaction(
            lines.map((line) =>
                dbClient.orderLine.update({
                    where: { id: line.id },
                    data: {
                        baseQuantity: line.quantity,
                        basePackageCount: line.packageCount,
                    },
                }),
            ),
        );
    }

    /**
     * Разморозить baseQuantity и basePackageCount при откате REORDER → COLLECTION.
     */
    async unfreezeBaseQuantities(purchaseId: number) {
        await dbClient.orderLine.updateMany({
            where: {
                status: 'ACTIVE',
                purchaseItem: { purchaseId },
            },
            data: {
                baseQuantity: null,
                basePackageCount: null,
            },
        });
    }

    /**
     * Обновить amountDue для конкретной строки заказа.
     */
    async updateAmountDue(id: number, amountDue: number) {
        return dbClient.orderLine.update({
            where: { id },
            data: { amountDue },
        });
    }
}
