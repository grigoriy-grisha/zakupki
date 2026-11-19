import { isPurchaseCompleted, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';

import type { OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { type PurchasePaymentSummary, summarizePurchasePayments } from '@/components/shop/payment-proof';

type PaymentLike = Parameters<typeof summarizePurchasePayments>[1][number] & { purchaseId: number };

export type GroupPaymentState = PurchasePaymentSummary & {
    /** По закупке открыта оплата и ещё есть что платить (неоплаченная ссылка тоже считается). */
    awaiting: boolean;
    /** Сколько осталось заплатить, не считая чеков на проверке. */
    toPay: number;
};

export function groupPaymentState(group: OrderPurchaseGroup, payments: readonly PaymentLike[]): GroupPaymentState {
    const summary = summarizePurchasePayments(
        group.total,
        payments.filter((p) => p.purchaseId === group.id),
    );
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const paymentOpen = !isPurchaseCompleted(group.status) && isPurchasePaymentOpen(fs);
    const toPay = Math.max(0, Math.round((summary.remaining - summary.pendingPaid) * 100) / 100);
    return { ...summary, toPay, awaiting: paymentOpen && toPay > 0.009 };
}

/** Сколько товаров и на какую сумму ждут оплаты — для счётчика на «Корзине» и сводки сверху. */
export function summarizeAwaitingPayment(
    groups: readonly OrderPurchaseGroup[],
    payments: readonly PaymentLike[],
): { items: number; amount: number; purchases: number } {
    let items = 0;
    let amount = 0;
    let purchases = 0;
    for (const group of groups) {
        const state = groupPaymentState(group, payments);
        if (!state.awaiting) continue;
        purchases += 1;
        items += group.orders.filter((o) => o.quantity > 0 || o.packageCount > 0).length;
        amount += state.toPay;
    }
    return { items, amount: Math.round(amount * 100) / 100, purchases };
}
