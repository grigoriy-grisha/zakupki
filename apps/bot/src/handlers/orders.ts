import { InlineKeyboard } from 'grammy';

import { isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';

import type { CustomContext } from '../domain/types';
import { formatPurchaseButtonLabel } from '../lib/purchase-button-label';
import type { ActivePurchaseSummary } from '../services/order.service';
import { OrderService } from '../services/order.service';
import { PaymentService } from '../services/payment.service';

function buildPurchasesKeyboard(purchases: ActivePurchaseSummary[]) {
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
    const orderService = new OrderService();
    const purchases = await orderService.getActivePurchases(userId);

    const text = orderService.formatPurchaseListMessage(purchases);
    const options = purchases.length > 0 ? { reply_markup: buildPurchasesKeyboard(purchases) } : {};

    const htmlOptions = { ...options, parse_mode: 'HTML' as const };

    if (edit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, htmlOptions);
    } else {
        await ctx.reply(text, htmlOptions);
    }
}

async function showPurchaseDetail(ctx: CustomContext, purchaseId: number) {
    const userId = ctx.session.userId!;
    const orderService = new OrderService();
    const paymentService = new PaymentService();

    const detail = await orderService.getPurchaseOrderDetail(userId, purchaseId);
    if (!detail) {
        await ctx.answerCallbackQuery({ text: 'Заказ не найден' });
        return;
    }

    const payment = await paymentService.getPurchasePaymentInfo(userId, purchaseId);
    const fulfillmentStatus = detail.lines[0]?.purchaseItem?.purchase?.fulfillmentStatus as
        | PurchaseFulfillmentStatus
        | undefined;
    const paymentOpen = isPurchasePaymentOpen(fulfillmentStatus);
    const canPay = Boolean(
        paymentOpen && payment && payment.remaining > 0 && !payment.hasPending,
    );

    const text = orderService.formatPurchaseDetailMessage(detail, payment, fulfillmentStatus);
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
