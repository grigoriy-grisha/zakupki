import { canCancelOrder, NotFoundError, OrderBook, ValidationError } from '@zakupki/types';
import type { OrderEffect, OrderLine, PurchaseItem } from '@zakupki/types';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { mapToPurchaseItem, toOrderLines } from '../lib/order-domain-mapper';
import type { PricingSettingsService } from '../services/settings/pricing-settings';

/**
 * Сервис заказов — Application-слой.
 *
 * Тонкая прослойка: fetch (репозитории) → map (Prisma→домен) → OrderBook (чистая
 * бизнес-логика, immutable aggregate) → persist (эффекты). Вся бизнес-логика живёт
 * в OrderBook (shared/types/src/order/) и тестируется без БД.
 *
 * Ключевое: COLLECTION-строки (createdOnStage='COLLECTION') — базовый заказ,
 * supplement-строки (createdOnStage!='COLLECTION') — добор из остатков.
 */
export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
        private pricingSettings: PricingSettingsService,
    ) {}

    // ── Public API: мутации ─────────────────────────────────────────

    /**
     * Изменить количество на delta.
     * COLLECTION/REORDER → COLLECTION-строка; PAYMENT+ → supplement-строка.
     */
    async adjustQuantity(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        const { item, lines } = await this.loadItem(purchaseItemId);
        const result = OrderBook.create(item, lines).adjust(userId, delta);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
    }

    /**
     * Изменить количество упаковок на delta (+1 / -1).
     * Упаковки доступны только на COLLECTION и REORDER — всегда COLLECTION-строка.
     */
    async adjustPackageCount(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        const { item, lines } = await this.loadItem(purchaseItemId);
        const result = OrderBook.create(item, lines).adjustPackages(userId, delta);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
    }

    // ── Public API: запросы ────────────────────────────────────────

    async getUserOrders(userId: number) {
        return this.repo.getByUser(userId);
    }

    /** Все ACTIVE строки пользователя для purchaseItem (базовые + supplement). */
    async getActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return this.repo.findAllActiveLinesForUserItem(purchaseItemId, userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async cancelOrder(id: number, userId: number) {
        const line = await this.repo.findById(id);
        if (!line) return null;
        if (line.userId !== userId) {
            throw new ValidationError('Нельзя отменить чужой заказ');
        }
        const fulfillmentStatus = line.purchaseItem?.purchase?.fulfillmentStatus ?? 'COLLECTION';
        if (!canCancelOrder(fulfillmentStatus)) {
            throw new ValidationError('На этом этапе нельзя отменить заказ');
        }
        return this.repo.cancelOrder(id);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }

    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        return this.repo.deleteAllByUserAndPurchase(userId, purchaseId);
    }

    async getActivePurchases(userId: number) {
        const orders = await this.repo.findActiveOrdersByUserId(userId);
        if (orders.length === 0) return [];

        const byPurchase = new Map<
            number,
            { purchaseId: number; tag: string; fulfillmentStatus: string; totalDue: number }
        >();
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

    async getPurchaseOrderDetail(userId: number, purchaseId: number) {
        const lines = await this.repo.findByUserAndPurchase(userId, purchaseId);
        if (lines.length === 0) return null;

        const first = lines[0]!;
        const tag = first.purchaseItem.purchase.tag;
        const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue), 0);

        return {
            purchaseOrderId: null as any,
            tag,
            totalDue,
            supplier: (first.purchaseItem.purchase as any).supplier ?? null,
            lines: lines.map((l) => ({
                id: l.id,
                quantity: Number(l.quantity),
                packageCount: l.packageCount ?? 0,
                amountDue: Number(l.amountDue),
                status: l.status,
                purchaseItem: l.purchaseItem,
                userId: l.userId,
                baseQuantity: l.baseQuantity,
                createdOnStage: (l as any).createdOnStage,
                tgChatMessageId: l.tgChatMessageId,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        };
    }

    // ── Внутренние: загрузка контекста + persistence ───────────────

    /** Загружает PurchaseItem + строки, мапит в доменную модель (PurchaseItem + OrderLine[]). */
    private async loadItem(purchaseItemId: number): Promise<{ item: PurchaseItem; lines: OrderLine[] }> {
        const row = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!row) throw new NotFoundError('Товар закупки', purchaseItemId);

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();
        return {
            item: mapToPurchaseItem(row, packDiscountPercent),
            lines: toOrderLines(row.orderLines as any),
        };
    }

    /** Применяет доменные эффекты через репозиторий. */
    private async persistEffects(effects: OrderEffect[]): Promise<void> {
        for (const effect of effects) {
            if (effect.type === 'delete') {
                await this.repo.deleteOrderLineById(effect.lineId);
            } else {
                await this.repo.upsertOrderLine(
                    effect.purchaseItemId,
                    effect.userId,
                    effect.quantity,
                    effect.amountDue,
                    effect.packageCount,
                    effect.createdOnStage,
                );
            }
        }
    }
}
