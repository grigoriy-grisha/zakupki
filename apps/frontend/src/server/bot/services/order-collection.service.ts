import { createLogger } from '@zakupki/logger';
import {
    AppError,
    buildOrderQtyOptions,
    computePackagePrice,
    computeUnitPriceRubNewModel,
    formatUnitQty,
    getActiveStep,
    getUnitByCode,
    isOrderingClosedStage,
    mapToPurchaseItem,
    mergeLines,
    toOrderLinesVO,
} from '@zakupki/types';

import type { ServiceContainer } from '../container/service-container';
import { getOrderQuantityHint } from '../lib/order-hints';
import { parseOrderQuantity } from '../lib/parse-order-quantity';
import type { ReplyToMessage } from '../lib/resolve-reply-purchase-item';
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
    | {
          ok: false;
          reason:
              | 'invalid_quantity'
              | 'product_not_found'
              | 'purchase_inactive'
              | 'error'
              | 'below_step'
              | 'not_step_multiple'
              | 'no_change'
              | 'ordering_closed';
          message: string;
      };

type ResolvedItem = NonNullable<Awaited<ReturnType<PurchaseItemResolver['resolvePurchaseItem']>>>;

const STEP_EPSILON = 1e-9;

const log = createLogger('order-collection');

/** Количество кратно шагу (с допуском на дробные шаги вроде 2.5). */
export function isStepMultiple(amount: number, step: number): boolean {
    if (!(step > 0)) return true;
    const ratio = amount / step;
    return Math.abs(ratio - Math.round(ratio)) < STEP_EPSILON;
}

/** Ближайшие кратные шагу значения вокруг amount — подсказка «например: 20 или 30». */
export function nearestStepMultiples(amount: number, step: number): number[] {
    const ratio = amount / step;
    const round = (v: number) => parseFloat(v.toFixed(3));
    const lower = round(Math.floor(ratio + STEP_EPSILON) * step);
    const upper = round(Math.ceil(ratio - STEP_EPSILON) * step);
    return [...new Set([lower, upper])].filter((v) => v > 0);
}

/**
 * Шаг количества для заказа из комментария. Тот же, что у кнопок +/− в приложении
 * (`buildDisplayContext().activeStep`): на COLLECTION — фасовка, на REORDER и
 * дальше — шаг добора. Им и проверяем, и сохраняем, чтобы проверка и запись
 * не расходились.
 */
function resolveActiveStep(item: ResolvedItem): number {
    return getActiveStep({
        fulfillmentStatus: item.purchase.fulfillmentStatus ?? 'COLLECTION',
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        options: buildOrderQtyOptions({
            multiplicity: Number(item.product.multiplicity) || 1,
            minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
            minPackageUnit: null,
            unitCode: item.unitCode ?? null,
        }),
    });
}

export class OrderCollectionService {
    private resolver: PurchaseItemResolver;
    private container: ServiceContainer | null;

    constructor(resolver?: PurchaseItemResolver, container?: ServiceContainer) {
        this.resolver = resolver ?? new PurchaseItemResolver();
        this.container = container ?? null;
    }

    static fromContainer(container: ServiceContainer): OrderCollectionService {
        return new OrderCollectionService(container.purchaseItemResolver, container);
    }

    async getQuantityHint(params: {
        chatId: number;
        replyTo?: ReplyToMessage;
        threadId?: number;
    }): Promise<string | null> {
        try {
            const item = await this.resolver.resolvePurchaseItem(params.chatId, {
                reply_to_message: params.replyTo,
                message_thread_id: params.threadId,
            });
            if (!item) return null;
            return getOrderQuantityHint(item.purchase?.fulfillmentStatus, item.unitCode);
        } catch {
            return null;
        }
    }

    async collectFromReply(params: {
        chatId: number;
        replyTo?: ReplyToMessage;
        threadId?: number;
        text: string;
        telegramId: string;
        userInfo: { firstName: string; lastName?: string; username?: string };
        messageId?: number;
    }): Promise<OrderCollectionResult> {
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

        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message: getOrderQuantityHint(purchaseItem.purchase?.fulfillmentStatus, purchaseItem.unitCode),
            };
        }

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

        const stepError = this.stepResult(purchaseItem, parsed);
        if (stepError) return stepError;

        try {
            const user = await this.container.userService.upsertFromTelegramBot(params.telegramId, params.userInfo);
            const pricing = await this.getItemPricing(purchaseItem);
            const before = await this.loadUserTotals(purchaseItem.id, user.id);
            await this.applyDelta(purchaseItem, user.id, parsed);
            const after = await this.loadUserTotals(purchaseItem.id, user.id);

            // Реакция «принято» ставится только на ok-результат, поэтому ok обязан
            // означать, что заказ в базе действительно изменился.
            if (after.quantity === before.quantity && after.packageCount === before.packageCount) {
                return {
                    ok: false,
                    reason: 'no_change',
                    message:
                        parsed.kind === 'subtract'
                            ? 'У вас нет заказа на этот товар — убирать нечего'
                            : 'Заказ не изменился. Попробуйте ещё раз или оформите заказ в приложении',
                };
            }

            const aggregated = after;
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
            // Доменные ошибки (лимит добора, «нельзя уменьшить на этом этапе») — понятный
            // человеку текст, его и показываем. Технические (БД, сеть) в чат не выносим.
            if (err instanceof AppError) {
                return { ok: false, reason: 'error', message: err.message };
            }
            log.error({ err, purchaseItemId: purchaseItem.id, telegramId: params.telegramId }, 'order save failed');
            return {
                ok: false,
                reason: 'error',
                message: 'Не удалось сохранить заказ. Попробуйте ещё раз или оформите заказ в приложении',
            };
        }
    }

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
        const unitShort = getUnitByCode(item.unitCode)?.shortName ?? 'ед.';
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
        const packagePrice = computePackagePrice(domainItem);
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
        // Целое число пачек проверено в stepResult.
        const sign = parsed.kind === 'add' ? 1 : -1;
        return this.container.orderService.adjustPackageCount(purchaseItemId, userId, parsed.amount * sign);
    }

    private async applyQuantityDelta(
        purchaseItem: ResolvedItem,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        if (!this.container) return;
        // Количество уже проверено в stepResult на кратность шагу — сохраняем как есть,
        // без округления (раньше округляли вниз до фасовки и молча теряли добор).
        const delta = parsed.kind === 'add' ? parsed.amount : -parsed.amount;
        return this.container.orderService.adjustQuantity(purchaseItem.id, userId, delta);
    }

    private async loadUserTotals(purchaseItemId: number, userId: number) {
        if (!this.container) return mergeLines([]);
        const lines = await this.container.orderService.getActiveLinesForUserItem(purchaseItemId, userId);
        return mergeLines(toOrderLinesVO(lines));
    }

    /**
     * Пачки — только целым числом. Количество «россыпью» — по активному шагу: не меньше шага и кратно ему.
     * Некратное количество отклоняем с подсказкой, а не округляем — человек
     * должен видеть, что записано ровно то, что он написал.
     */
    private stepResult(
        item: ResolvedItem,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ): Extract<OrderCollectionResult, { ok: false }> | null {
        if (parsed.unit === 'packs') {
            if (Number.isInteger(parsed.amount)) return null;
            return {
                ok: false,
                reason: 'invalid_quantity',
                message: 'Пачки указываются целым числом. Например: 2п',
            };
        }
        const step = resolveActiveStep(item);
        const unitCode = item.unitCode ?? null;
        const sign = parsed.kind === 'subtract' ? '-' : '';

        if (parsed.kind === 'add' && parsed.amount < step - STEP_EPSILON) {
            return {
                ok: false,
                reason: 'below_step',
                message: `Минимальный шаг заказа — ${formatUnitQty(step, unitCode)}. Например: ${step}`,
            };
        }
        if (isStepMultiple(parsed.amount, step)) return null;

        const examples = nearestStepMultiples(parsed.amount, step).map((v) => `${sign}${v}`);
        return {
            ok: false,
            reason: 'not_step_multiple',
            message: `Количество должно быть кратно ${formatUnitQty(step, unitCode)}. Например: ${examples.join(' или ')}`,
        };
    }
}
