import { NotFoundError, ValidationError, canAdjustOrder } from '@zakupki/types';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';

/**
 * Простой сервис заказов — только +мин.фасовка / −мин.фасовка.
 */
export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
    ) {}

    /**
     * Изменить количество на delta (может быть положительным или отрицательным).
     * delta = +minPackaging или -minPackaging.
     */
    async adjustQuantity(purchaseItemId: number, userId: number, delta: number) {
        if (delta === 0) return;

        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!item) {
            throw new NotFoundError('Товар закупки', purchaseItemId);
        }

        // Проверяем фазу — можно ли вообще менять заказ
        const status = item.purchase.fulfillmentStatus ?? item.purchase.status;
        if (!canAdjustOrder(status)) {
            throw new ValidationError('На этом этапе заказ изменять нельзя');
        }

        const existing = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        const currentQty = existing ? Number(existing.quantity) : 0;
        const newQty = currentQty + delta;

        if (newQty <= 0) {
            // Удаляем строку заказа
            return this.repo.deleteOrderLine(purchaseItemId, userId);
        }

        // Проверяем остаток
        const available = Number(item.product.referenceStock) || 0;
        if (available > 0 && newQty > available) {
            throw new ValidationError(`Превышен остаток. Доступно: ${available}`);
        }

        // Вычисляем сумму
        const pricePerUnit = Number(item.product.pricePerUnit);
        const amountDue = newQty * pricePerUnit;

        return this.repo.upsertOrderLine(purchaseItemId, userId, newQty, amountDue);
    }

    /**
     * Добавить товар в заказ (absolute quantity).
     * @deprecated Use adjustQuantity instead
     */
    async addItem(purchaseItemId: number, userId: number, quantity: number) {
        if (quantity <= 0) {
            throw new ValidationError('Количество должно быть больше 0');
        }

        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!item) {
            throw new NotFoundError('Товар закупки', purchaseItemId);
        }

        if (item.purchase.status !== 'ACTIVE') {
            throw new ValidationError('Закупка неактивна');
        }

        // Проверяем остаток
        const available = Number(item.product.referenceStock) || 0;
        if (available > 0 && quantity > available) {
            throw new ValidationError(`Доступно только ${available} ${item.product.unitCode}`);
        }

        // Находим существующую строку заказа или создаём новую
        const existing = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        const currentQty = existing ? Number(existing.quantity) : 0;
        const newQty = currentQty + quantity;

        // Проверяем что не превышаем остаток
        if (available > 0 && newQty > available) {
            throw new ValidationError(`Превышен остаток. Доступно: ${available}`);
        }

        // Вычисляем сумму
        const pricePerUnit = Number(item.product.pricePerUnit);
        const amountDue = newQty * pricePerUnit;

        return this.repo.upsertOrderLine(purchaseItemId, userId, newQty, amountDue);
    }

    /**
     * Убрать товар из заказа.
     * @deprecated Use adjustQuantity instead
     */
    async removeItem(purchaseItemId: number, userId: number, quantity: number) {
        if (quantity <= 0) {
            throw new ValidationError('Количество должно быть больше 0');
        }

        const existing = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        if (!existing) {
            throw new ValidationError('Товар не найден в заказе');
        }

        const currentQty = Number(existing.quantity);
        const newQty = currentQty - quantity;

        if (newQty <= 0) {
            // Удаляем строку заказа
            return this.repo.deleteOrderLine(purchaseItemId, userId);
        }

        // Пересчитываем сумму
        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        const pricePerUnit = item ? Number(item.product.pricePerUnit) : 0;
        const amountDue = newQty * pricePerUnit;

        return this.repo.upsertOrderLine(purchaseItemId, userId, newQty, amountDue);
    }

    async getUserOrders(userId: number) {
        return this.repo.getByUser(userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async cancelOrder(id: number, userId: number) {
        const line = await this.repo.findById(id);
        if (!line) {
            return null;
        }
        if (line.userId !== userId) {
            throw new ValidationError('Нельзя отменить чужой заказ');
        }
        return this.repo.cancelOrder(id);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }

    /**
     * Удалить все заказы пользователя в закупке.
     */
    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        return this.repo.deleteAllByUserAndPurchase(userId, purchaseId);
    }

    /**
     * Получить активные закупки пользователя (у которых есть неотменённые заказы).
     */
    async getActivePurchases(userId: number) {
        const orders = await this.repo.findActiveOrdersByUserId(userId);
        if (orders.length === 0) return [];

        // Группируем по purchaseId
        const byPurchase = new Map<number, { purchaseId: number; tag: string; fulfillmentStatus: string; totalDue: number }>();
        for (const line of orders) {
            const p = line.purchaseItem.purchase;
            const existing = byPurchase.get(p.id);
            if (existing) {
                existing.totalDue += Number(line.amountDue);
            } else {
                byPurchase.set(p.id, {
                    purchaseId: p.id,
                    tag: p.tag,
                    fulfillmentStatus: (p as any).fulfillmentStatus ?? 'COLLECTION',
                    totalDue: Number(line.amountDue),
                });
            }
        }
        return Array.from(byPurchase.values());
    }

    /**
     * Получить детали заказа пользователя по закупке.
     */
    async getPurchaseOrderDetail(userId: number, purchaseId: number) {
        const lines = await this.repo.findByUserAndPurchase(userId, purchaseId);
        if (lines.length === 0) return null;

        const tag = lines[0]!.purchaseItem.purchase.tag;
        const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue), 0);

        return {
            purchaseOrderId: null as any,
            tag,
            totalDue,
            supplier: (lines[0]!.purchaseItem.purchase as any).supplier ?? null,
            lines: lines.map((l) => ({
                id: l.id,
                quantity: Number(l.quantity),
                amountDue: Number(l.amountDue),
                status: l.status,
                purchaseItem: l.purchaseItem,
                userId: l.userId,
                baseQuantity: l.baseQuantity,
                tgChatMessageId: l.tgChatMessageId,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        };
    }
}