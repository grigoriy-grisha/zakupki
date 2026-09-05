import { createLogger } from '@zakupki/logger';
import type { EventBus } from '@zakupki/queue';
import type { OrderEffect, OrderLine, PurchaseItem } from '@zakupki/types';
import {
    canCancelOrder,
    ForbiddenError,
    type HandoffStatus,
    NotFoundError,
    OrderBook,
    PurchaseNotActiveError,
    resolveCurrencyRate,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
    userEffectiveQty,
    ValidationError,
} from '@zakupki/types';

import type { OrderRepository } from '../domain/order.repository';
import type { PurchaseRepository } from '../domain/purchase.repository';
import { mapToPurchaseItem, toOrderLines } from '../lib/order-domain-mapper';
import type { NotificationService } from '../services/notification.service';
import type { PricingSettingsService } from '../services/settings/pricing-settings';

const log = createLogger('order-service');

export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
        private pricingSettings: PricingSettingsService,
        private eventBus: EventBus,
        private notification: NotificationService,
    ) {}

    async adjustQuantity(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        const { item, lines, row } = await this.loadItem(purchaseItemId);
        if (delta > 0) this.assertUserCanIncrease(row);
        const result = OrderBook.create(item, lines).adjust(userId, delta);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
    }

    async adjustPackageCount(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        const { item, lines, row } = await this.loadItem(purchaseItemId);
        if (delta > 0) this.assertUserCanIncrease(row);
        const result = OrderBook.create(item, lines).adjustPackages(userId, delta);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
    }

    async adminAdd(purchaseItemId: number, userId: number, amount: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminAdd(userId, amount);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, result.book.activeLines);
    }

    async adminDecrease(purchaseItemId: number, userId: number, amount: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminDecrease(userId, amount);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
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

    async adminAdjust(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        if (delta > 0) return this.adminAdd(purchaseItemId, userId, delta);
        return this.adminDecrease(purchaseItemId, userId, -delta);
    }

    async adminAdjustPackageCount(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        if (delta === 0) return;
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminAdjustPackages(userId, delta);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
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

    async getUserOrders(userId: number) {
        const [lines, orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.repo.getByUser(userId),
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);
        return lines.map((line) => ({
            ...line,
            priceInfo: this.priceInfoForLine(line, orgFeeDefaultPercent, packDiscountPercent),
        }));
    }

    async findAllByUserWithPriceInfo(userId: number) {
        const [lines, orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.repo.findAllByUserId(userId),
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);
        return lines.map((line) => ({
            ...line,
            priceInfo: this.priceInfoForLine(line, orgFeeDefaultPercent, packDiscountPercent),
        }));
    }

    private priceInfoForLine(
        line: {
            purchaseItem: {
                currencyId: number | null;
                pricePerPackCurrency: unknown;
                packAmount: unknown;
                orgFeePercentOverride: unknown;
                deliveryPercentOverride: unknown;
                purchase: {
                    deliveryPercent: unknown;
                    currencyRates: { currencyId: number; rateToRub: unknown }[];
                } | null;
            } | null;
        },
        orgFeeDefaultPercent: number,
        packDiscountPercent: number,
    ) {
        const item = line.purchaseItem;
        const purchase = item?.purchase;
        if (!item || !purchase) return null;
        const rateToRub = resolveCurrencyRate(
            (purchase.currencyRates ?? []).map((r) => ({
                currencyId: r.currencyId,
                rateToRub: Number(r.rateToRub),
            })),
            item.currencyId ?? null,
        );
        return {
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            rateToRub,
            packSize: item.packAmount != null ? Number(item.packAmount) : null,
            packDiscountPercent,
            orgFeePercent: resolveOrgFeePercent(
                item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
                orgFeeDefaultPercent,
            ),
            deliveryPercent: resolveDeliveryPercent(
                item.deliveryPercentOverride != null ? Number(item.deliveryPercentOverride) : null,
                Number(purchase.deliveryPercent ?? 0),
            ),
        };
    }

    async getActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return this.repo.findAllActiveLinesForUserItem(purchaseItemId, userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getPurchaseOrdersByPurchase(purchaseId: number) {
        return this.repo.findPurchaseOrdersByPurchase(purchaseId);
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
        await this.repo.deletePurchaseOrder(userId, purchaseId);
        await Promise.all(itemIds.map((id) => this.eventBus.emitPurchaseItemChanged(id)));
        await this.notifyOrderCleared(userId, purchaseId);
        return result;
    }

    async addParticipant(userId: number, purchaseId: number): Promise<number> {
        const created = await this.repo.ensurePurchaseOrder(userId, purchaseId);
        return created.id;
    }

    async setHandoffStatus(purchaseOrderId: number, status: HandoffStatus | null, actorId: number): Promise<void> {
        const po = await this.repo.findPurchaseOrderWithPurchase(purchaseOrderId);
        if (!po) throw new NotFoundError('Заказ участника', purchaseOrderId);
        if ((po.handoffStatus as HandoffStatus | null) === status) return;

        await this.repo.setHandoffStatus(purchaseOrderId, status, actorId);
        if (status === 'ASSEMBLED') {
            await this.notification.notify({
                userId: po.userId,
                type: 'ORDER_ASSEMBLED',
                payload: { purchaseId: po.purchaseId, purchaseTag: po.purchase.tag, purchaseOrderId },
            });
            return;
        }
        await this.notifyHandoffStatusChanged(po.userId, po.purchaseId, po.purchase.tag, status);
    }

    async setHandoffChoice(
        purchaseOrderId: number,
        userId: number,
        choice: 'STORED' | 'READY_TO_SHIP',
    ): Promise<{ purchaseId: number; purchaseTag: string }> {
        const po = await this.repo.findPurchaseOrderWithPurchase(purchaseOrderId);
        if (!po) throw new NotFoundError('Заказ участника', purchaseOrderId);
        if (po.userId !== userId) throw new ForbiddenError('Это не ваш заказ');
        if ((po.handoffStatus as HandoffStatus | null) === choice) {
            return { purchaseId: po.purchaseId, purchaseTag: po.purchase.tag };
        }

        await this.repo.setHandoffStatus(purchaseOrderId, choice, userId);
        await this.notification.notifyInApp({
            userId: po.userId,
            type: choice === 'STORED' ? 'ORDER_HANDOFF_STORED' : 'ORDER_HANDOFF_SHIP_REQUEST',
            payload: { purchaseId: po.purchaseId, purchaseTag: po.purchase.tag },
        });
        return { purchaseId: po.purchaseId, purchaseTag: po.purchase.tag };
    }

    async deleteAllByUserAndItem(purchaseItemId: number, userId: number): Promise<void> {
        await this.repo.deleteAllByUserAndItem(purchaseItemId, userId);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        await this.notifyOrderLineDeleted(purchaseItemId, userId);
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
                    fulfillmentStatus: p.fulfillmentStatus ?? 'COLLECTION',
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
            purchaseOrderId: null,
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
                createdOnStage: l.createdOnStage,
                tgChatMessageId: l.tgChatMessageId,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        };
    }

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

    private async notifyHandoffStatusChanged(
        userId: number,
        purchaseId: number,
        purchaseTag: string,
        status: HandoffStatus | null,
    ): Promise<void> {
        try {
            await this.notification.notify({
                userId,
                type: 'ORDER_HANDOFF_STATUS',
                payload: { purchaseId, purchaseTag, status },
            });
        } catch (err) {
            log.warn({ purchaseId, userId, status, err }, 'failed to notify about handoff status change');
        }
    }

    private async loadItem(purchaseItemId: number): Promise<{
        item: PurchaseItem;
        lines: OrderLine[];
        row: NonNullable<Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>>;
    }> {
        const row = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!row) throw new NotFoundError('Товар закупки', purchaseItemId);

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();
        const orgFeeDefaultPercent = await this.pricingSettings.getOrgFeeDefaultPercent();
        const currencyRates = (row.purchase?.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        return {
            item: mapToPurchaseItem(row, packDiscountPercent, {
                orgFeeDefaultPercent,
                currencyRates,
                deliveryPercent: Number(row.purchase?.deliveryPercent ?? 0),
            }),
            lines: toOrderLines(row.orderLines),
            row,
        };
    }

    private assertUserCanIncrease(row: {
        hidden: boolean;
        purchase: { status: string; deletedAt: Date | null } | null;
    }): void {
        if (row.purchase?.deletedAt != null) {
            throw new ValidationError('Закупка удалена — заказы не принимаются');
        }
        if (row.purchase != null && row.purchase.status !== 'ACTIVE') {
            throw new PurchaseNotActiveError(row.purchase.status);
        }
        if (row.hidden) {
            throw new ValidationError('Товар скрыт и недоступен для заказа');
        }
    }

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
