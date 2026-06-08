import { dbClient, Prisma } from '@zakupki/database';
import { NotFoundError } from '@zakupki/types';

import { productInclude } from './product-include';
import { USER_CREDENTIALS_INCLUDE } from './user.types';

export class OrderRepository {
    /**
     * Создать или обновить строку заказа.
     */
    async upsertOrderLine(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
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

        return dbClient.orderLine.upsert({
            where: { purchaseItemId_userId: { purchaseItemId, userId } },
            create: {
                purchaseItemId,
                userId,
                quantity,
                amountDue,
                status: 'ACTIVE',
            },
            update: {
                quantity,
                amountDue,
                status: 'ACTIVE',
            },
        });
    }

    /**
     * Удалить строку заказа.
     */
    async deleteOrderLine(purchaseItemId: number, userId: number) {
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
            include: { purchaseItem: { include: { purchase: { select: { status: true } } } } },
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
        return dbClient.$executeRaw`
            UPDATE order_line
            SET base_quantity = quantity
            FROM purchase_item
            WHERE order_line.purchase_item_id = purchase_item.id
              AND purchase_item.purchase_id = ${purchaseId}
              AND order_line.status = 'ACTIVE'
              AND order_line.base_quantity IS NULL
        `;
    }

    /**
     * Разморозить baseQuantity при откате REORDER → COLLECTION.
     */
    async unfreezeBaseQuantities(purchaseId: number) {
        return dbClient.$executeRaw`
            UPDATE order_line
            SET base_quantity = NULL
            FROM purchase_item
            WHERE order_line.purchase_item_id = purchase_item.id
              AND purchase_item.purchase_id = ${purchaseId}
              AND order_line.status = 'ACTIVE'
        `;
    }
}
