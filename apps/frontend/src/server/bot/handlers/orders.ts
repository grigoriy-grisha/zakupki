import { InlineKeyboard } from 'grammy';

import { getUnitByCode, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { serviceContainer } from '@/server/lib/service-container';

import type { CustomContext } from '../domain/types';
import { formatPurchaseButtonLabel } from '../lib/purchase-button-label';

function buildPurchasesKeyboard(
    purchases: Awaited<ReturnType<typeof serviceContainer.order.getActivePurchases>>,
) {
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

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function formatPurchasesList(
    purchases: Awaited<ReturnType<typeof serviceContainer.order.getActivePurchases>>,
): string {
    if (purchases.length === 0) {
        return 'У вас нет заказов в активных закупках.';
    }

    const PURCHASE_FULFILLMENT_LABELS: Record<string, string> = {
        COLLECTION: 'Сбор заказов',
        REORDER: 'Доборы',
        PAYMENT: 'Оплата заказов',
        SUPPLIER_ASSEMBLY: 'На комплектации у поставщика',
        PREPARING_SHIPMENT_RF: 'Подготовка к отправке в РФ',
        IN_TRANSIT_RF: 'Едет в РФ',
        IN_TRANSIT_TO_ORGANIZER: 'Едет до организатора',
        PACKAGING: 'Фасовка',
        READY_FOR_PICKUP: 'Заказы готовы к выдаче (отправке)',
    };

    const lines = purchases.map((p) => {
        const statusLabel = PURCHASE_FULFILLMENT_LABELS[p.fulfillmentStatus] ?? p.fulfillmentStatus;
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

    const payment = await serviceContainer.payment.getPurchasePaymentInfo(userId, purchaseId);
    const fulfillmentStatus = detail.lines[0]?.purchaseItem?.purchase?.fulfillmentStatus as
        | PurchaseFulfillmentStatus
        | undefined;
    const paymentOpen = isPurchasePaymentOpen(fulfillmentStatus);
    const canPay = Boolean(paymentOpen && payment && payment.remaining > 0 && !payment.hasPending);

    const text = formatPurchaseDetail(detail, payment, fulfillmentStatus);
    const keyboard = buildDetailKeyboard(
        purchaseId,
        canPay,
        paymentOpen,
        Boolean(payment && payment.remaining > 0),
    );

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
    const PURCHASE_FULFILLMENT_LABELS: Record<string, string> = {
        COLLECTION: 'Сбор заказов',
        REORDER: 'Доборы',
        PAYMENT: 'Оплата заказов',
        SUPPLIER_ASSEMBLY: 'На комплектации у поставщика',
        PREPARING_SHIPMENT_RF: 'Подготовка к отправке в РФ',
        IN_TRANSIT_RF: 'Едет в РФ',
        IN_TRANSIT_TO_ORGANIZER: 'Едет до организатора',
        PACKAGING: 'Фасовка',
        READY_FOR_PICKUP: 'Заказы готовы к выдаче (отправке)',
    };

    const status = fulfillmentStatus ?? 'COLLECTION';
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[status] ?? status;

    const lineTexts = detail.lines.map((line) => {
        const product = line.purchaseItem?.product;
        const unit = product ? getUnitByCode(product.unitCode)?.shortName ?? '' : '';
        const qty = Number(line.quantity).toLocaleString('ru-RU');
        const amount = Number(line.amountDue).toLocaleString('ru-RU');
        const name = escapeHtml(product?.name ?? 'Товар');
        return `▫️ <b>${name}</b>\n<code>${qty}${unit ? ` ${escapeHtml(unit)}` : ''} · ${amount} ₽</code>`;
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
