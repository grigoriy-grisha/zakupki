import { dbClient, Prisma } from '@zakupki/database';
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
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            create: {
                purchaseItemId,
                userId,
                ...data,
                ...(packageCount != null ? { packageCount } : {}),
            },
            update: data,
        });
    }

    /**
     * Удалить строку заказа (hard delete — только для COLLECTION).
     */
    async deleteOrderLine(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.deleteMany({
            where: { purchaseItemId, userId },
        });
    }

    /**
     * Обнулить строку заказа без удаления — сохранить baseQuantity.
     * Используется на REORDER+ вместо hard delete, чтобы не потерять
     * информацию о базовом заказе и разрешить повторный добор.
     */
    async zeroOutOrderLine(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.update({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            data: { quantity: 0, amountDue: 0, packageCount: 0 },
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

    findByPurchaseItemAndUser(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findUnique({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
        });
    }

    findPurchaseOrder(userId: number, purchaseId: number) {
        return dbClient.purchaseOrder.findUnique({
            where: { userId_purchaseId: { userId, purchaseId } },
        });
    }

    findPurchaseOrdersByUser(userId: number) {
        return dbClient.purchaseOrder.findMany({ where: { userId } });
    }

    findPurchaseOrdersByPurchase(purchaseId: number) {
        return dbClient.purchaseOrder.findMany({ where: { purchaseId } });
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

    async getByPurchaseItem(purchaseItemId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId, status: 'ACTIVE' },
            include: { user: true },
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
     * Заморозить baseQuantity для всех строк закупки (при переходе COLLECTION → REORDER).
     * Устанавливает baseQuantity = current quantity для всех ACTIVE строк.
     */
    async freezeBaseQuantities(purchaseId: number) {
        const lines = await dbClient.orderLine.findMany({
            where: {
                status: 'ACTIVE',
                baseQuantity: null,
                purchaseItem: { purchaseId },
            },
            select: { id: true, quantity: true },
        });

        await dbClient.$transaction(
            lines.map((line) =>
                dbClient.orderLine.update({
                    where: { id: line.id },
                    data: { baseQuantity: line.quantity },
                }),
            ),
        );
    }

    /**
     * Разморозить baseQuantity при откате REORDER → COLLECTION.
     */
    async unfreezeBaseQuantities(purchaseId: number) {
        await dbClient.orderLine.updateMany({
            where: {
                status: 'ACTIVE',
                purchaseItem: { purchaseId },
            },
            data: { baseQuantity: null },
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
