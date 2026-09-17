import {
    buildQuantityDisplay,
    computeOrderLinePriceBreakdown,
    isPurchasePaymentOpen,
    mergeLines,
    type OrderLinePriceBreakdown,
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
    toOrderLinesVO,
} from '@zakupki/types';
import { InlineKeyboard } from 'grammy';

import { formatPurchaseProductLine1 } from '@/lib/product-label/format-purchase';

import { getActiveBotConfig } from '../../config/bot-config';
import type { ServiceContainer } from '../../container/service-container';
import type { CallbackAction } from '../../domain/callback-data';
import type { CallbackHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { escapeHtml } from '../../lib/html';
import { buildMiniAppTargetUrl, shopTargetDeepLink } from '../../lib/webapp-url';
import type {
    BotOrderLinePriceInfo,
    BotPurchaseListItem,
    BotPurchaseOrderDetail,
} from '../../services/bot/bot-order.service';

function buildPurchasesKeyboard(purchases: BotPurchaseListItem[]) {
    const keyboard = new InlineKeyboard();
    for (const p of purchases) {
        keyboard.text(`${p.tag} — ${p.fulfillmentStatus}`, `orders:pick:${p.purchaseId}`).row();
    }
    return keyboard;
}

function buildDetailKeyboard(purchaseId: number, canPay: boolean, paymentOpen: boolean, hasDebt: boolean) {
    const keyboard = new InlineKeyboard();
    if (canPay) {
        keyboard.text('Приложить чек об оплате', `pay:pick:${purchaseId}`).row();
    } else if (hasDebt && !paymentOpen) {
        keyboard.text('Ждём начала оплаты', 'orders:noop').row();
    }
    keyboard.text('← К списку закупок', 'orders:list');
    return keyboard;
}

async function replyPurchasesList(
    ctx: CustomContext,
    container: ServiceContainer,
    edit = false,
): Promise<void> {
    const userId = ctx.session.userId!;
    const purchases = await container.orderService.getActivePurchases(userId);

    const text = formatPurchasesList(purchases);
    const options = purchases.length > 0 ? { reply_markup: buildPurchasesKeyboard(purchases) } : {};
    const htmlOptions = { ...options, parse_mode: 'HTML' as const };

    if (edit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, htmlOptions);
    } else {
        await ctx.reply(text, htmlOptions);
    }
}

function formatPurchasesList(purchases: BotPurchaseListItem[]): string {
    if (purchases.length === 0) {
        return 'У вас нет заказов в активных закупках.';
    }
    const lines = purchases.map((p) => {
        const statusLabel = p.fulfillmentStatus ?? 'COLLECTION';
        return `• <b>${escapeHtml(p.tag)}</b>\n  ${escapeHtml(statusLabel)} · ${p.totalDue.toLocaleString('ru-RU')} ₽`;
    });
    return `${lines.join('\n\n')}\n\nВыберите закупку:`;
}

async function showPurchaseDetail(
    ctx: CustomContext,
    container: ServiceContainer,
    purchaseId: number,
): Promise<void> {
    const userId = ctx.session.userId!;
    const detail = await container.orderService.getPurchaseOrderDetail(userId, purchaseId);
    if (!detail) {
        await ctx.answerCallbackQuery({ text: 'Заказ не найден' });
        return;
    }

    const payment = await container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
    const fulfillmentStatus = detail.lines[0]?.purchaseItem?.purchase?.fulfillmentStatus as
        | PurchaseFulfillmentStatus
        | undefined;
    const paymentOpen = isPurchasePaymentOpen(fulfillmentStatus);
    const canPay = Boolean(paymentOpen && payment && payment.remaining > 0 && !payment.hasPending);

    const text = formatPurchaseDetail(detail, purchaseId, payment, fulfillmentStatus);
    const keyboard = buildDetailKeyboard(purchaseId, canPay, paymentOpen, Boolean(payment && payment.remaining > 0));

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/** Прямая https-ссылка на карточку товара; t.me-диплинк — если домен не настроен. */
function buildItemLink(purchaseId: number, purchaseItemId: number): string | null {
    const cfg = getActiveBotConfig();
    if (cfg.webapp.url) return buildMiniAppTargetUrl(cfg.webapp.url, purchaseId, purchaseItemId);
    return shopTargetDeepLink(cfg, purchaseId, purchaseItemId)?.url ?? null;
}

function computeGroupBreakdown(g: {
    totalAmount: number;
    qty: number;
    packs: number;
    priceInfo: BotOrderLinePriceInfo | null;
}): OrderLinePriceBreakdown | null {
    if (!g.priceInfo) return null;
    return computeOrderLinePriceBreakdown({
        amountDue: g.totalAmount,
        quantity: g.qty,
        packageCount: g.packs,
        pricePerPackCurrency: g.priceInfo.pricePerPackCurrency,
        rateToRub: g.priceInfo.rateToRub,
        packSize: g.priceInfo.packSize,
        orgFeePercent: g.priceInfo.orgFeePercent,
        deliveryPercent: g.priceInfo.deliveryPercent,
        packDiscountPercent: g.priceInfo.packDiscountPercent,
    });
}

function formatLineBreakdown(breakdown: OrderLinePriceBreakdown | null): string | null {
    if (!breakdown) return null;
    const parts = [`товар ${breakdown.baseRub.toLocaleString('ru-RU')} ₽`];
    if (breakdown.orgFeeRub > 0) parts.push(`оргсбор ${breakdown.orgFeeRub.toLocaleString('ru-RU')} ₽`);
    if (breakdown.deliveryRub > 0) parts.push(`доставка ${breakdown.deliveryRub.toLocaleString('ru-RU')} ₽`);
    return `<i>${parts.join(' · ')}</i>`;
}

/** Суммарная разбивка по всем строкам заказа; null — если хоть по одной строке цены не сходятся. */
function formatOrderBreakdown(groups: {
    totalAmount: number;
    qty: number;
    packs: number;
    priceInfo: BotOrderLinePriceInfo | null;
}[]): string | null {
    const breakdowns = groups.map((g) => computeGroupBreakdown(g));
    if (breakdowns.length === 0 || breakdowns.some((b) => b == null)) return null;
    const total = breakdowns.reduce(
        (acc, b) => ({
            baseRub: acc.baseRub + b!.baseRub,
            orgFeeRub: acc.orgFeeRub + b!.orgFeeRub,
            deliveryRub: acc.deliveryRub + b!.deliveryRub,
        }),
        { baseRub: 0, orgFeeRub: 0, deliveryRub: 0 },
    );
    return (
        `<i>товар ${total.baseRub.toLocaleString('ru-RU')} ₽ · ` +
        `оргсбор ${total.orgFeeRub.toLocaleString('ru-RU')} ₽ · ` +
        `доставка ${total.deliveryRub.toLocaleString('ru-RU')} ₽</i>`
    );
}

function formatPurchaseDetail(
    detail: BotPurchaseOrderDetail,
    purchaseId: number,
    payment: { due: number; paid: number; hasPending: boolean; remaining: number; tag: string } | null,
    fulfillmentStatus?: PurchaseFulfillmentStatus | null,
): string {
    const status = (fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[status] ?? status;

        const groupedLines = new Map<
            number,
            {
                purchaseItemId: number;
                name: string;
                unitCode: string | null;
                packSize: number | null;
                qty: number;
                packs: number;
                totalAmount: number;
                priceInfo: BotOrderLinePriceInfo | null;
            }
        >();
        for (const line of detail.lines) {
            const product = line.purchaseItem?.product;
            const piId = line.purchaseItem?.id ?? 0;
            const name = product
                ? formatPurchaseProductLine1({ name: product.name, articleNumber: product.articleNumber })
                : 'Товар';
            const unitCode = line.purchaseItem?.unitCode ?? null;
            const packSize =
                line.purchaseItem?.packAmount != null ? Number(line.purchaseItem.packAmount) : null;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aggregated = mergeLines(toOrderLinesVO([line as any]));
            const existing = groupedLines.get(piId);
            if (existing) {
                existing.qty += aggregated.quantity;
                existing.packs += aggregated.packageCount;
                existing.totalAmount += aggregated.amountDue;
            } else {
                groupedLines.set(piId, {
                    purchaseItemId: piId,
                    name,
                    unitCode,
                    packSize,
                    qty: aggregated.quantity,
                    packs: aggregated.packageCount,
                    totalAmount: aggregated.amountDue,
                    priceInfo: line.priceInfo,
                });
            }
        }

        const groups = Array.from(groupedLines.values());
        const lineTexts = groups.map((g) => {
            const qtyLabel = buildQuantityDisplay({
                quantity: g.qty,
                packageCount: g.packs,
                packSize: g.packSize,
                unitCode: g.unitCode,
            }).main;
            const hasAmount = g.totalAmount > 0 || (g.qty === 0 && g.packs === 0);
            const amountLabel = hasAmount ? `${g.totalAmount.toLocaleString('ru-RU')} ₽` : 'цена уточняется';

            const link = g.purchaseItemId > 0 ? buildItemLink(purchaseId, g.purchaseItemId) : null;
            const nameHtml = link
                ? `<a href="${escapeHtml(link)}"><b>${escapeHtml(g.name)}</b></a>`
                : `<b>${escapeHtml(g.name)}</b>`;
            const breakdownText = formatLineBreakdown(computeGroupBreakdown(g));

            return (
                `• ${nameHtml}\n<code>${escapeHtml(qtyLabel)} · ${amountLabel}</code>` +
                (breakdownText ? `\n${breakdownText}` : '')
            );
        });
        const orderBreakdownText = formatOrderBreakdown(groups);

    const parts = [
        detail.purchaseOrderId != null ? `Заказ №${detail.purchaseOrderId}` : null,
        `<b>${escapeHtml(detail.tag)}</b>`,
        `Статус: ${escapeHtml(fulfillmentLabel)}`,
        '',
        lineTexts.join('\n\n'),
        '',
        `<b>Итого: ${detail.totalDue.toLocaleString('ru-RU')} ₽</b>`,
        orderBreakdownText,
    ];

    if (payment) {
        if (payment.paid > 0) {
            parts.push(`Учтено оплат: ${payment.paid.toLocaleString('ru-RU')} ₽`);
        }
        if (payment.hasPending) {
            parts.push('Есть оплата на проверке');
        } else if (!isPurchasePaymentOpen(status) && payment.remaining > 0) {
            parts.push('Пока нельзя оплатить заказ');
            parts.push('Ждём начала оплаты — следите за статусом выше');
        } else if (payment.remaining > 0) {
            parts.push(`К оплате: ${payment.remaining.toLocaleString('ru-RU')} ₽`);
        } else if (payment.due > 0) {
            parts.push('Оплачено');
        }
    }

    return parts.filter((p) => p !== null).join('\n');
}

/**
 * Обрабатывает все callback'и с префиксом `orders:`.
 */
export class OrdersCallbackQueryHandler implements CallbackHandler {
    readonly prefix = 'orders:';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, action: CallbackAction): Promise<void> {
        switch (action.kind) {
            case 'orders:list':
                await ctx.answerCallbackQuery();
                await replyPurchasesList(ctx, this.container, true);
                return;

            case 'orders:noop':
                await ctx.answerCallbackQuery({
                    text: 'Пока нельзя оплатить — ждём начала оплаты',
                    show_alert: true,
                });
                return;

            case 'orders:pick':
                await showPurchaseDetail(ctx, this.container, action.purchaseId);
                return;

            default:
                await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
        }
    }
}
