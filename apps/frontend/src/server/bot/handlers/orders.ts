import { InlineKeyboard } from 'grammy';

import {
    getUnitByCode,
    isPurchasePaymentOpen,
    mergeLines,
    PURCHASE_FULFILLMENT_LABELS,
    toOrderLinesVO,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { serviceContainer } from '@/server/lib/service-container';

import type { CustomContext } from '../domain/types';
import { formatPurchaseButtonLabel } from '../lib/purchase-button-label';
import { escapeHtml } from '../lib/html';

function buildPurchasesKeyboard(purchases: Awaited<ReturnType<typeof serviceContainer.order.getActivePurchases>>) {
    const keyboard = new InlineKeyboard();
    for (const p of purchases) {
        const label = formatPurchaseButtonLabel(p.tag, p.fulfillmentStatus);
        keyboard.text(label, `orders:pick:${p.purchaseId}`).row();
    }
    return keyboard;
}

function buildDetailKeyboard(purchaseId: number, canPay: boolean, paymentOpen: boolean, hasDebt: boolean) {
    const keyboard = new InlineKeyboard();
    if (canPay) {
        keyboard.text('📎 Приложить чек об оплате', `pay:pick:${purchaseId}`).row();
    } else if (hasDebt && !paymentOpen) {
        keyboard.text('⏳ Ждём начала оплаты', 'orders:noop').row();
    }
    keyboard.text('← К списку закупок', 'orders:list');
    return keyboard;
}

async function replyPurchasesList(ctx: CustomContext, edit = false) {
    const userId = ctx.session.userId!;
    const purchases = await serviceContainer.order.getActivePurchases(userId);

    const text = formatPurchasesList(purchases);
    const options = purchases.length > 0 ? { reply_markup: buildPurchasesKeyboard(purchases) } : {};

    const htmlOptions = { ...options, parse_mode: 'HTML' as const };

    if (edit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, htmlOptions);
    } else {
        await ctx.reply(text, htmlOptions);
    }
}

function formatPurchasesList(purchases: Awaited<ReturnType<typeof serviceContainer.order.getActivePurchases>>): string {
    if (purchases.length === 0) {
        return 'У вас нет заказов в активных закупках.';
    }

    const lines = purchases.map((p) => {
        const statusLabel =
            PURCHASE_FULFILLMENT_LABELS[p.fulfillmentStatus as PurchaseFulfillmentStatus] ?? p.fulfillmentStatus;
        return `• <b>${escapeHtml(p.tag)}</b>\n  ${escapeHtml(statusLabel)} · ${p.totalDue.toLocaleString('ru-RU')} ₽`;
    });

    return `${lines.join('\n\n')}\n\nВыберите закупку:`;
}

async function showPurchaseDetail(ctx: CustomContext, purchaseId: number) {
    const userId = ctx.session.userId!;

    const detail = await serviceContainer.order.getPurchaseOrderDetail(userId, purchaseId);
    if (!detail) {
        await ctx.answerCallbackQuery({ text: 'Заказ не найден' });
        return;
    }

    const payment = await serviceContainer.botPayment.getPurchasePaymentInfo(userId, purchaseId);
    const fulfillmentStatus = detail.lines[0]?.purchaseItem?.purchase?.fulfillmentStatus as
        | PurchaseFulfillmentStatus
        | undefined;
    const paymentOpen = isPurchasePaymentOpen(fulfillmentStatus);
    const canPay = Boolean(paymentOpen && payment && payment.remaining > 0 && !payment.hasPending);

    const text = formatPurchaseDetail(detail, payment, fulfillmentStatus);
    const keyboard = buildDetailKeyboard(purchaseId, canPay, paymentOpen, Boolean(payment && payment.remaining > 0));

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
    });
}

function formatPurchaseDetail(
    detail: NonNullable<Awaited<ReturnType<typeof serviceContainer.order.getPurchaseOrderDetail>>>,
    payment: { due: number; paid: number; hasPending: boolean; remaining: number; tag: string } | null,
    fulfillmentStatus?: PurchaseFulfillmentStatus | null,
): string {
    const status = fulfillmentStatus ?? 'COLLECTION';
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[status as PurchaseFulfillmentStatus] ?? status;

    // Группируем строки по purchaseItemId (COLLECTION + supplement → одна запись) через домен
    const groupedLines = new Map<number, { name: string; unit: string; totalQty: number; totalAmount: number }>();
    for (const line of detail.lines) {
        const product = line.purchaseItem?.product;
        const piId = line.purchaseItem?.id ?? 0;
        const name = product?.name ?? 'Товар';
        const unit = product ? (getUnitByCode(product.unitCode)?.shortName ?? '') : '';

        const aggregated = mergeLines(toOrderLinesVO([line as any]));
        const existing = groupedLines.get(piId);
        if (existing) {
            existing.totalQty += aggregated.quantity;
            existing.totalAmount += aggregated.amountDue;
        } else {
            groupedLines.set(piId, { name, unit, totalQty: aggregated.quantity, totalAmount: aggregated.amountDue });
        }
    }

    const lineTexts = Array.from(groupedLines.values()).map((g) => {
        const qty = g.totalQty.toLocaleString('ru-RU');
        const amount = g.totalAmount.toLocaleString('ru-RU');
        return `▫️ <b>${escapeHtml(g.name)}</b>\n<code>${qty}${g.unit ? ` ${escapeHtml(g.unit)}` : ''} · ${amount} ₽</code>`;
    });

    const parts = [
        detail.purchaseOrderId != null ? `📦 Заказ №${detail.purchaseOrderId}` : null,
        `🛒 <b>${escapeHtml(detail.tag)}</b>`,
        `📋 Статус: ${escapeHtml(fulfillmentLabel)}`,
        detail.supplier ? `Поставщик: ${escapeHtml(detail.supplier)}` : null,
        '',
        lineTexts.join('\n\n'),
        '',
        `💰 <b>Итого: ${detail.totalDue.toLocaleString('ru-RU')} ₽</b>`,
    ];

    if (payment) {
        if (payment.paid > 0) {
            parts.push(`✅ Учтено оплат: ${payment.paid.toLocaleString('ru-RU')} ₽`);
        }
        if (payment.hasPending) {
            parts.push('⏳ Есть оплата на проверке');
        } else if (!isPurchasePaymentOpen(status) && payment.remaining > 0) {
            parts.push('❌ Пока нельзя оплатить заказ');
            parts.push('⏳ Ждём начала оплаты — следите за статусом выше');
        } else if (payment.remaining > 0) {
            parts.push(`📌 К оплате: ${payment.remaining.toLocaleString('ru-RU')} ₽`);
        } else if (payment.due > 0) {
            parts.push('✅ Оплачено');
        }
    }

    return parts.filter((p) => p !== null).join('\n');
}

export async function ordersCommand(ctx: CustomContext) {
    await replyPurchasesList(ctx, false);
}

export async function ordersCallbackQuery(ctx: CustomContext) {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith('orders:')) return;

    if (data === 'orders:list') {
        await ctx.answerCallbackQuery();
        await replyPurchasesList(ctx, true);
        return;
    }

    if (data === 'orders:noop') {
        await ctx.answerCallbackQuery({
            text: 'Пока нельзя оплатить — ждём начала оплаты',
            show_alert: true,
        });
        return;
    }

    if (data.startsWith('orders:pick:')) {
        const purchaseId = Number(data.slice('orders:pick:'.length));
        if (!Number.isFinite(purchaseId)) {
            await ctx.answerCallbackQuery({ text: 'Некорректная закупка' });
            return;
        }
        await showPurchaseDetail(ctx, purchaseId);
    }
}
