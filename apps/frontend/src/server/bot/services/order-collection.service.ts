import {
    computePackagePrice,
    getOrderQuantityStep,
    getUnitByCode,
    mapToPurchaseItem,
    mergeLines,
    toOrderLinesVO,
} from '@zakupki/types';

import type { ServiceContainer } from '../container/service-container';
import { parseOrderQuantity } from '../lib/parse-order-quantity';
import { PurchaseItemResolver } from './purchase-item-resolver';

export type OrderCollectionAction = { amount: number; unit: 'remainder' | 'packs' };

export type OrderCollectionResult =
    | {
          ok: true;
          productName: string;
          purchaseItemId: number;
          internalUserId: number;
          quantity: number;
          packageCount: number;
          unitShort: string;
          amountDue: number;
          purchaseTag: string;
          pricePerUnit: number;
          packSize: number | null;
          packagePrice: number | null;
          added?: OrderCollectionAction;
          subtracted?: OrderCollectionAction;
          cancelled?: boolean;
      }
    | { ok: false; reason: 'invalid_quantity' | 'product_not_found' | 'purchase_inactive' | 'error'; message: string };

type ResolvedItem = NonNullable<Awaited<ReturnType<PurchaseItemResolver['resolvePurchaseItem']>>>;

export class OrderCollectionService {
    private resolver: PurchaseItemResolver;
    private container: ServiceContainer | null;

    constructor(resolver?: PurchaseItemResolver, container?: ServiceContainer) {
        this.resolver = resolver ?? new PurchaseItemResolver();
        this.container = container ?? null;
    }

    /**
     * Вспомогательный: создать сервис с инстансом из ServiceContainer.
     */
    static fromContainer(container: ServiceContainer): OrderCollectionService {
        return new OrderCollectionService(container.purchaseItemResolver, container);
    }

    async collectFromReply(params: {
        chatId: number;
        replyTo?: import('../lib/resolve-reply-purchase-item').ReplyToMessage;
        threadId?: number;
        text: string;
        telegramId: string;
        userInfo: { firstName: string; lastName?: string; username?: string };
        messageId?: number;
    }): Promise<OrderCollectionResult> {
        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message: 'Напишите количество числом, например: 10 (граммов) или +2п (две пачки) или -1п (снять пачку)',
            };
        }

        const purchaseItem = await this.resolver.resolvePurchaseItem(params.chatId, {
            reply_to_message: params.replyTo,
            message_thread_id: params.threadId,
        });

        if (!purchaseItem?.product) {
            return {
                ok: false,
                reason: 'product_not_found',
                message: 'Не найден товар для этого сообщения',
            };
        }

        if (!this.container) {
            return { ok: false, reason: 'error', message: 'ServiceContainer not wired' };
        }

        const user = await this.container.userService.upsertFromTelegramBot(params.telegramId, params.userInfo);
        const pricing = this.getItemPricing(purchaseItem);

        try {
            await this.applyDelta(purchaseItem, user.id, parsed);

            const allLines = await this.container.orderService.getActiveLinesForUserItem(purchaseItem.id, user.id);
            const aggregated = mergeLines(toOrderLinesVO(allLines));
            const hasLines = aggregated.quantity > 0;

            if (!hasLines) {
                return this.buildResult(purchaseItem, user.id, pricing, parsed, {
                    quantity: 0,
                    packageCount: 0,
                    amountDue: 0,
                    cancelled: true,
                });
            }

            return this.buildResult(purchaseItem, user.id, pricing, parsed, {
                quantity: aggregated.quantity,
                packageCount: aggregated.packageCount,
                amountDue: aggregated.amountDue,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сохранить заказ';
            return { ok: false, reason: 'error', message };
        }
    }

    // ── Private helpers ───────────────────────────────────────────

    private buildResult(
        item: ResolvedItem,
        userId: number,
        pricing: ReturnType<typeof this.getItemPricing>,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
        line: { quantity: number; packageCount: number; amountDue: number; cancelled?: true },
    ): Extract<OrderCollectionResult, { ok: true }> {
        const action: OrderCollectionAction = { amount: parsed.amount, unit: parsed.unit };
        return {
            ok: true,
            productName: item.product.name,
            purchaseItemId: item.id,
            internalUserId: userId,
            quantity: line.quantity,
            packageCount: line.packageCount,
            unitShort: pricing.unitShort,
            amountDue: line.amountDue,
            purchaseTag: item.purchase.tag,
            pricePerUnit: pricing.pricePerUnit,
            packSize: pricing.packSize,
            packagePrice: pricing.packagePrice,
            added: parsed.kind === 'add' ? action : undefined,
            subtracted: parsed.kind === 'subtract' ? action : undefined,
            ...(line.cancelled ? { cancelled: true } : {}),
        };
    }

    private getItemPricing(item: ResolvedItem) {
        const unitShort = getUnitByCode(item.product.unitCode)?.shortName ?? 'ед.';
        const packSize = item.product.supplierPackageAmount != null ? Number(item.product.supplierPackageAmount) : null;
        const pricePerUnit = Number(item.priceOverride ?? item.product.pricePerUnit);
        const packagePrice = computePackagePrice(mapToPurchaseItem(item, 0));
        return { unitShort, packSize, pricePerUnit, packagePrice };
    }

    private async applyDelta(
        purchaseItem: ResolvedItem,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        if (!this.container) return;
        if (parsed.unit === 'packs') {
            return this.applyPackDelta(purchaseItem.id, userId, parsed);
        }
        return this.applyQuantityDelta(purchaseItem, userId, parsed);
    }

    private async applyPackDelta(
        purchaseItemId: number,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        if (!this.container) return;
        const count = Math.round(parsed.amount);
        const sign = parsed.kind === 'add' ? 1 : -1;
        return this.container.orderService.adjustPackageCount(purchaseItemId, userId, count * sign);
    }

    private async applyQuantityDelta(
        purchaseItem: ResolvedItem,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        if (!this.container) return;
        const step = getOrderQuantityStep({
            minPackageAmount: Number(purchaseItem.product.minPackageAmount) || null,
            multiplicity: Number(purchaseItem.product.multiplicity) || null,
        });
        const steps = Math.round(parsed.amount / step);
        const delta = parsed.kind === 'add' ? steps * step : -steps * step;
        return this.container.orderService.adjustQuantity(purchaseItem.id, userId, delta);
    }
}
