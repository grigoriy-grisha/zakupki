import { canCancelOrder, NotFoundError, OrderBook, userEffectiveQty, ValidationError } from '@zakupki/types';
import type { OrderEffect, OrderLine, PurchaseItem } from '@zakupki/types';
import { EventBus } from '@zakupki/queue';
import { createLogger } from '@zakupki/logger';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { mapToPurchaseItem, toOrderLines } from '../lib/order-domain-mapper';
import type { PricingSettingsService } from '../services/settings/pricing-settings';
import type { NotificationService } from '../services/notification.service';

const log = createLogger('order-service');

/**
 * Сервис заказов — Application-слой.
 *
 * Тонкая прослойка: fetch (репозитории) → map (Prisma→домен) → OrderBook (чистая
 * бизнес-логика, immutable aggregate) → persist (эффекты). Вся бизнес-логика живёт
 * в OrderBook (shared/types/src/order/) и тестируется без БД.
 *
 * Ключевое: COLLECTION-строки (createdOnStage='COLLECTION') — базовый заказ,
 * supplement-строки (createdOnStage!='COLLECTION') — добор из остатков.
 *
 * Каждая мутация, меняющая сумму активных orderLines, эмитит
 * `eventBus.emitPurchaseItemChanged` — это пушит обновление поста в канале
 * (worker пересобирает «Свободно к заказу» из актуальной БД).
 *
 * Admin-мутации (adminAdd/adminDecrease/adminSetQuantity/delete/
 * removeAllByUserFromPurchase) дополнительно пушат перечисленное выше
 * пользователю через NotificationService. Ошибки notify логируются и не
 * пробрасываются — статус основной мутации не должен откатываться из-за
 * сбоя доставки уведомления.
 */
export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
        private pricingSettings: PricingSettingsService,
        private eventBus: EventBus,
        private notification: NotificationService,
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
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
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
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
    }

    // ── Public API: admin-мутации (в обход stage-прав, пула, лимитов) ──

    /**
     * Admin: добавить amount к заказу пользователя (по purchaseItem).
     * Идёт в обход правил этапа/пула/лимита поставщика. amountDue пересчитывается.
     * Если строки нет — создаётся COLLECTION-строка (годится для «добавить позицию»).
     */
    async adminAdd(purchaseItemId: number, userId: number, amount: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminAdd(userId, amount);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, result.book.activeLines);
    }

    /**
     * Admin: убавить amount (supplement-first). До 0 → удаление строки.
     * В обход правил этапа.
     */
    async adminDecrease(purchaseItemId: number, userId: number, amount: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminDecrease(userId, amount);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        // If all of the user's lines on this item got deleted, treat as line deleted.
        const remaining = result.book.activeLines.filter((l) => l.userId === userId);
        if (remaining.length === 0) {
            await this.notifyOrderLineDeleted(purchaseItemId, userId);
        } else {
            await this.notifyOrderQtyChanged(
                purchaseItemId,
                userId,
                item.packAmount,
                prevQty,
                result.book.activeLines,
            );
        }
    }

    /**
     * Admin: установить точное суммарное qty (схлопывает в одну COLLECTION-строку;
     * qty=0 → удаляет все строки пользователя по item). В обход всех правил.
     */
    async adminSetQuantity(purchaseItemId: number, userId: number, qty: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminSetQuantity(userId, qty);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        if (qty === 0) {
            await this.notifyOrderLineDeleted(purchaseItemId, userId);
        } else {
            await this.notifyOrderQtyChanged(
                purchaseItemId,
                userId,
                item.packAmount,
                prevQty,
                result.book.activeLines,
            );
        }
    }

    /**
     * Admin: ± на delta для UI. delta>0 → adminAdd, delta<0 → adminDecrease.
     * delta=0 — no-op.
     */
    async adminAdjust(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        if (delta > 0) return this.adminAdd(purchaseItemId, userId, delta);
        return this.adminDecrease(purchaseItemId, userId, -delta);
    }

    /**
     * Все заказы пользователя (в т.ч. CANCELLED). Используется для админ-карточки.
     */
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

    /** Все строки пользователя (для расчёта карты оплат ботом). */
    async findAllActiveByUser(userId: number) {
        return this.repo.findAllByUserId(userId);
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
        const result = await this.repo.cancelOrder(id);
        await this.eventBus.emitPurchaseItemChanged(line.purchaseItemId);
        return result;
    }

    async delete(id: number) {
        const line = await this.repo.findById(id);
        const result = await this.repo.delete(id);
        if (line) {
            await this.eventBus.emitPurchaseItemChanged(line.purchaseItemId);
            await this.notifyOrderLineDeleted(line.purchaseItemId, line.userId);
        }
        return result;
    }

    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        const itemIds = await this.repo.findPurchaseItemIdsByUserAndPurchase(userId, purchaseId);
        const result = await this.repo.deleteAllByUserAndPurchase(userId, purchaseId);
        await Promise.all(itemIds.map((id) => this.eventBus.emitPurchaseItemChanged(id)));
        await this.notifyOrderCleared(userId, purchaseId);
        return result;
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

    // ── Внутренние: уведомления об админ-мутациях (best-effort) ──────

    /**
     * Notify that the user's quantity on an item changed. Uses the in-memory
     * `activeLines` snapshot from the just-applied OrderBook to compute the new
     * total without an extra DB hit. `packSize` (the item's pack weight in base
     * units) is required so packages are correctly counted into the total —
     * passing null would silently drop package grams from the number shown.
     *
     * `prevQty` is computed before the mutation, `newQty` after — both are
     * surfaced so the UI can show Было/Стало instead of only the result.
     */
    private async notifyOrderQtyChanged(
        purchaseItemId: number,
        userId: number,
        packSize: number | null,
        prevQty: number,
        activeLines: readonly OrderLine[],
    ): Promise<void> {
        try {
            const label = await this.purchaseRepo.findItemLabel(purchaseItemId);
            if (!label) return;
            const newQty = userEffectiveQty(activeLines as OrderLine[], userId, packSize);
            await this.notification.notify({
                userId,
                type: 'ORDER_QTY_CHANGED',
                payload: {
                    purchaseId: label.purchaseId,
                    purchaseTag: label.purchaseTag,
                    // Service-only coalesce key — see NotificationService.tryCoalesce.
                    purchaseItemId,
                    productLabel: label.productLabel,
                    prevQty,
                    newQty,
                    unitShort: label.unitShort,
                },
            });
        } catch (err) {
            log.warn({ purchaseItemId, userId, err }, 'failed to notify about order qty change');
        }
    }

    /** Notify that an item line was removed from the user's order. */
    private async notifyOrderLineDeleted(purchaseItemId: number, userId: number): Promise<void> {
        try {
            const label = await this.purchaseRepo.findItemLabel(purchaseItemId);
            if (!label) return;
            await this.notification.notify({
                userId,
                type: 'ORDER_LINE_DELETED',
                payload: {
                    purchaseId: label.purchaseId,
                    purchaseTag: label.purchaseTag,
                    purchaseItemId,
                    productLabel: label.productLabel,
                },
            });
        } catch (err) {
            log.warn({ purchaseItemId, userId, err }, 'failed to notify about order line deletion');
        }
    }

    /** Notify that the user's entire order in a purchase was cleared. */
    private async notifyOrderCleared(userId: number, purchaseId: number): Promise<void> {
        try {
            const purchaseTag = await this.purchaseRepo.findTagById(purchaseId);
            if (!purchaseTag) return;
            await this.notification.notify({
                userId,
                type: 'ORDER_CLEARED',
                payload: { purchaseId, purchaseTag },
            });
        } catch (err) {
            log.warn({ purchaseId, userId, err }, 'failed to notify about order cleared');
        }
    }

    // ── Внутренние: загрузка контекста + persistence ───────────────

    /** Загружает PurchaseItem + строки, мапит в доменную модель (PurchaseItem + OrderLine[]). */
    private async loadItem(purchaseItemId: number): Promise<{ item: PurchaseItem; lines: OrderLine[] }> {
        const row = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!row) throw new NotFoundError('Товар закупки', purchaseItemId);

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();
        const orgFeeDefaultPercent = await this.pricingSettings.getOrgFeeDefaultPercent();
        const currencyRates = (row.purchase?.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        return {
            item: mapToPurchaseItem(row, packDiscountPercent, { orgFeeDefaultPercent, currencyRates }),
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
