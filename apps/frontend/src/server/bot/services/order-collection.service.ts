import {
    buildOrderQtyOptions,
    computeUnitPriceRubNewModel,
    getActiveStep,
    getOrderQuantityStep,
    getUnitByCode,
    isOrderingClosedStage,
    isWeightUnit,
    mapToPurchaseItem,
    mergeLines,
    toOrderLinesVO,
} from '@zakupki/types';

import type { ServiceContainer } from '../container/service-container';
import { getOrderQuantityHint } from '../lib/order-hints';
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
          unitPriceRub: number;
          packSize: number | null;
          packagePrice: number | null;
          added?: OrderCollectionAction;
          subtracted?: OrderCollectionAction;
          cancelled?: boolean;
      }
    | { ok: false; reason: 'invalid_quantity' | 'product_not_found' | 'purchase_inactive' | 'error' | 'below_step' | 'ordering_closed'; message: string };

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

    /**
     * Подсказка по формату количества для чата закупки: зависит от этапа
     * (на доборе — расширенный текст про граммы и «п»).
     */
    async getQuantityHint(params: {
        chatId: number;
        replyTo?: import('../lib/resolve-reply-purchase-item').ReplyToMessage;
        threadId?: number;
    }): Promise<string> {
        try {
            const purchaseItem = await this.resolver.resolvePurchaseItem(params.chatId, {
                reply_to_message: params.replyTo,
                message_thread_id: params.threadId,
            });
            return getOrderQuantityHint(
                purchaseItem?.purchase?.fulfillmentStatus,
                isWeightUnit(purchaseItem?.product?.unitCode),
            );
        } catch {
            return getOrderQuantityHint(null);
        }
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
                message: await this.getQuantityHint(params),
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

        // Hidden items are not orderable — resolver already filters them out,
        // but guard here as well (defense in depth for cached resolutions).
        if (purchaseItem.hidden) {
            return {
                ok: false,
                reason: 'product_not_found',
                message: 'Этот товар больше недоступен для заказа',
            };
        }

        if (purchaseItem.purchase.deletedAt) {
            return {
                ok: false,
                reason: 'purchase_inactive',
                message: 'Закупка удалена — заказы больше не принимаются',
            };
        }

        if (parsed.kind === 'add' && isOrderingClosedStage(purchaseItem.purchase.fulfillmentStatus ?? 'COLLECTION')) {
            return {
                ok: false,
                reason: 'ordering_closed',
                message: 'Приём заказов завершён — этот товар больше заказать нельзя',
            };
        }

        if (!this.container) {
            return { ok: false, reason: 'error', message: 'ServiceContainer not wired' };
        }

        const user = await this.container.userService.upsertFromTelegramBot(params.telegramId, params.userInfo);
        const pricing = await this.getItemPricing(purchaseItem);

        const belowStep = this.belowStepResult(purchaseItem, parsed, pricing.unitShort);
        if (belowStep) return belowStep;

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
        pricing: Awaited<ReturnType<typeof this.getItemPricing>>,
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
            unitPriceRub: pricing.unitPriceRub,
            packSize: pricing.packSize,
            packagePrice: pricing.packagePrice,
            added: parsed.kind === 'add' ? action : undefined,
            subtracted: parsed.kind === 'subtract' ? action : undefined,
            ...(line.cancelled ? { cancelled: true } : {}),
        };
    }

    private async getItemPricing(item: ResolvedItem) {
        const unitShort = getUnitByCode(item.product.unitCode)?.shortName ?? 'ед.';
        const orgFeeDefaultPercent = this.container
            ? await this.container.pricingSettings.getOrgFeeDefaultPercent()
            : 0;
        const currencyRates = (item.purchase?.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        const packDiscountPercent = this.container
            ? await this.container.pricingSettings.getBeadPackPriceDiscountPercent()
            : 0;
        const domainItem = mapToPurchaseItem(item, packDiscountPercent, {
            orgFeeDefaultPercent,
            currencyRates,
            deliveryPercent: Number(item.purchase?.deliveryPercent ?? 0),
        });

        const unitPriceRub = computeUnitPriceRubNewModel(domainItem) ?? 0;
        const packSize = item.packAmount != null ? Number(item.packAmount) : null;
        const packagePrice = packSize != null ? packSize * unitPriceRub : 0;
        return { unitShort, packSize, unitPriceRub, packagePrice };
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
        const step = getOrderQuantityStep(
            buildOrderQtyOptions({
                multiplicity: Number(purchaseItem.product.multiplicity) || 1,
                minPackageAmount:
                    purchaseItem.minPackageAmount != null ? Number(purchaseItem.minPackageAmount) : null,
                minPackageUnit: null,
                unitCode: purchaseItem.product.unitCode ?? null,
            }),
        );
        const steps = Math.round(parsed.amount / step);
        const delta = parsed.kind === 'add' ? steps * step : -steps * step;
        return this.container.orderService.adjustQuantity(purchaseItem.id, userId, delta);
    }

    /** На этапе добора запрещаем добавлять количество меньше шага (supplementStep). */
    private belowStepResult(
        item: ResolvedItem,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
        unitShort: string,
    ): OrderCollectionResult | null {
        if (parsed.kind !== 'add' || parsed.unit !== 'remainder') return null;
        const step = getActiveStep({
            fulfillmentStatus: item.purchase.fulfillmentStatus ?? 'COLLECTION',
            supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
            options: buildOrderQtyOptions({
                multiplicity: Number(item.product.multiplicity) || 1,
                minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
                minPackageUnit: null,
                unitCode: item.product.unitCode ?? null,
            }),
        });
        if (parsed.amount >= step) return null;
        return {
            ok: false,
            reason: 'below_step',
            message: `Минимальный шаг заказа — ${step} ${unitShort}. Например: ${step}`,
        };
    }
}
