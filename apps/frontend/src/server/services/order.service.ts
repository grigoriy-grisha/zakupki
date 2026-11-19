import { createLogger } from '@zakupki/logger';
import type { EventBus } from '@zakupki/queue';
import type { OrderEffect, OrderLine, PurchaseItem } from '@zakupki/types';
import {
    canCancelOrder,
    computeAmountDueWithPackages,
    computeOrderLinePriceBreakdown,
    ForbiddenError,
    type HandoffStatus,
    NotFoundError,
    OrderBook,
    PurchaseNotActiveError,
    userEffectiveQty,
    ValidationError,
} from '@zakupki/types';

import { formatPurchaseProductLine1 } from '@/lib/product-label/format-purchase';

import type { OrderRepository } from '../domain/order.repository';
import type { PurchaseRepository } from '../domain/purchase.repository';
import { buildLinePriceInfo } from '../lib/line-price-info';
import { mapToPurchaseItem, toOrderLines } from '../lib/order-domain-mapper';
import type { PaymentBreakdownLine } from '../lib/tbank/payment-breakdown';
import { formatReceiptLineName } from '../lib/tbank/payment-breakdown';
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
        await this.persistEffects(result.changes, {
            soft: !result.book.activeLines.some((l) => l.userId === userId),
        });
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        const remaining = result.book.activeLines.filter((l) => l.userId === userId);
        if (remaining.length === 0) {
            await this.notifyOrderLineDeleted(purchaseItemId, userId);
        } else {
            await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, result.book.activeLines);
        }
    }

    async adminSetQuantity(purchaseItemId: number, userId: number, qty: number): Promise<void> {
        const { item, lines } = await this.loadItem(purchaseItemId);
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        const result = OrderBook.create(item, lines).adminSetQuantity(userId, qty);
        if (!result.ok) throw new ValidationError(result.error.message);
        await this.persistEffects(result.changes, {
            soft: !result.book.activeLines.some((l) => l.userId === userId),
        });
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        if (qty === 0) {
            await this.notifyOrderLineDeleted(purchaseItemId, userId);
        } else {
            await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, result.book.activeLines);
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
        await this.persistEffects(result.changes, {
            soft: !result.book.activeLines.some((l) => l.userId === userId),
        });
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        const remaining = result.book.activeLines.filter((l) => l.userId === userId);
        if (remaining.length === 0) {
            await this.notifyOrderLineDeleted(purchaseItemId, userId);
        } else {
            await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, result.book.activeLines);
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
            priceInfo: buildLinePriceInfo(line, orgFeeDefaultPercent, packDiscountPercent),
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
            priceInfo: buildLinePriceInfo(line, orgFeeDefaultPercent, packDiscountPercent),
        }));
    }

    /** Что клиент купил в закупке и из чего сложилась сумма каждой строки — для чека онлайн-оплаты. */
    async getPaymentBreakdownLines(userId: number, purchaseId: number): Promise<PaymentBreakdownLine[]> {
        const [lines, orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.repo.findReceiptLines(userId, purchaseId),
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);
        return lines.map((line) => {
            const amountDue = Number(line.amountDue);
            const quantity = Number(line.quantity);
            const packageCount = Number(line.packageCount ?? 0);
            const priceInfo = buildLinePriceInfo(line, orgFeeDefaultPercent, packDiscountPercent);
            const breakdown = priceInfo
                ? computeOrderLinePriceBreakdown({ amountDue, quantity, packageCount, ...priceInfo })
                : null;
            const item = line.purchaseItem;
            const packSize = item.packAmount != null ? Number(item.packAmount) : 0;
            const effectiveQty = quantity + packageCount * packSize;
            const product = item.product;
            const title = formatPurchaseProductLine1(product);
            const brand = product.brand?.name?.trim();
            const name = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${title}` : title;
            return {
                name: formatReceiptLineName({
                    name,
                    quantity: effectiveQty,
                    unitCode: item.unitCode,
                    packSize,
                    price: breakdown?.baseRub ?? amountDue,
                }),
                amountDue,
                base: breakdown?.baseRub ?? null,
                delivery: breakdown?.deliveryRub ?? 0,
                org: breakdown?.orgFeeRub ?? 0,
            };
        });
    }

    async getActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return this.repo.findAllActiveLinesForUserItem(purchaseItemId, userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getByPurchaseAndUser(purchaseId: number, userId: number) {
        return this.repo.getByPurchaseAndUser(purchaseId, userId);
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

    async delete(id: number): Promise<void> {
        const line = await this.repo.findById(id);
        if (!line) return;
        // Снимок для «Вернуть» имеет смысл, только если это последняя строка товара у участника:
        // иначе он скрыт за оставшимися строками и потом молча затрётся.
        // Если участник уже платил, позицию не стираем, а отменяем: иначе пропадает след того,
        // за что он заплатил, и переплату нечем объяснить.
        const purchaseId = line.purchaseItem?.purchaseId;
        const paid = purchaseId != null && (await this.repo.hasPaymentsInPurchase(line.userId, purchaseId));
        const siblings = await this.repo.countActiveLinesByUserAndItem(line.purchaseItemId, line.userId);
        if (siblings > 1 && !paid) await this.repo.deleteOrderLineById(id);
        else await this.repo.softDeleteLines([id]);
        await this.eventBus.emitPurchaseItemChanged(line.purchaseItemId);
        await this.notifyOrderLineDeleted(line.purchaseItemId, line.userId);
    }

    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        const itemIds = await this.repo.findPurchaseItemIdsByUserAndPurchase(userId, purchaseId);
        let result: { count: number };
        if (await this.repo.hasPaymentsInPurchase(userId, purchaseId)) {
            // Участник платил: позиции отменяем, заказ оставляем — клиент увидит переплату,
            // а админ сможет сделать возврат.
            const ids = await this.repo.findActiveLineIdsByUserAndPurchase(userId, purchaseId);
            await this.repo.softDeleteLines(ids);
            result = { count: ids.length };
        } else {
            result = await this.repo.deleteAllByUserAndPurchase(userId, purchaseId);
            await this.repo.deletePurchaseOrder(userId, purchaseId);
        }
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
        const ids = await this.repo.findActiveLineIdsByUserAndItem(purchaseItemId, userId);
        await this.repo.softDeleteLines(ids);
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        await this.notifyOrderLineDeleted(purchaseItemId, userId);
    }

    /** Удалённые админом позиции закупки (для блока «Удалённые» у участника). */
    async getRemovedByPurchase(purchaseId: number) {
        const [removed, activeKeys] = await Promise.all([
            this.repo.findRemovedByPurchase(purchaseId),
            this.repo.findActiveUserItemKeys(purchaseId),
        ]);
        // Товар, который у участника снова есть в заказе, «удалённым» не показываем.
        return removed.filter((l) => !activeKeys.has(`${l.userId}:${l.purchaseItemId}`));
    }

    /** Вернуть удалённую админом позицию участника с прежним количеством. */
    async restoreUserItem(purchaseItemId: number, userId: number): Promise<void> {
        const removed = await this.repo.findRemovedLinesByUserAndItem(purchaseItemId, userId);
        if (removed.length === 0) throw new ValidationError('Эта позиция уже возвращена');
        const { item, lines } = await this.loadItem(purchaseItemId);
        if (lines.some((l) => l.userId === userId && l.status === 'ACTIVE')) {
            throw new ValidationError('Этот товар уже есть в заказе — измените количество');
        }
        const prevQty = userEffectiveQty(lines, userId, item.packAmount);
        await this.repo.restoreLines(
            removed.map((line) => {
                const quantity = Number(line.removedQuantity ?? 0);
                const packageCount = line.removedPackageCount ?? 0;
                const amountDue = computeAmountDueWithPackages(quantity, packageCount, item);
                return { id: line.id, quantity, packageCount, amountDue };
            }),
        );
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        const after = await this.loadItem(purchaseItemId);
        const book = OrderBook.create(after.item, after.lines);
        await this.notifyOrderQtyChanged(purchaseItemId, userId, item.packAmount, prevQty, book.activeLines);
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

        const [orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);

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
                priceInfo: buildLinePriceInfo(l, orgFeeDefaultPercent, packDiscountPercent),
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

    /** soft — админ убрал позицию до нуля: строка остаётся «удалённой», чтобы её можно было вернуть. */
    private async persistEffects(effects: OrderEffect[], options: { soft?: boolean } = {}): Promise<void> {
        // Мягкое удаление — одним вызовом: иначе каждый вызов сбрасывал бы снимок
        // только что удалённых соседних строк того же товара.
        const softIds: number[] = [];
        for (const effect of effects) {
            if (effect.type === 'delete') {
                if (options.soft) softIds.push(effect.lineId);
                else await this.repo.deleteOrderLineById(effect.lineId);
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
        if (softIds.length > 0) await this.repo.softDeleteLines(softIds);
    }
}
