'use client';

import { summarizePurchasePayments } from '@/components/shop/payment-proof';
import { trpc } from '@/lib/client/trpc';

/**
 * Payment summary for a single purchase.
 * Used on the purchase detail page.
 */
export function usePurchasePaymentDetail(purchaseId: number) {
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    const myOrdersInPurchase = myOrders?.filter((o) => o.purchaseItem?.purchaseId === purchaseId) ?? [];
    const totalDue = myOrdersInPurchase.reduce((sum, o) => sum + Number(o.amountDue), 0);

    const purchasePayments = myPayments?.filter((p) => p.purchaseId === purchaseId) ?? [];
    const hasRejected = purchasePayments.some((p) => (p as { status: string }).status === 'REJECTED');
    const summary = summarizePurchasePayments(totalDue, purchasePayments);

    return {
        myOrders,
        myOrdersInPurchase,
        totalDue,
        purchasePayments,
        hasPending: summary.hasPending,
        hasRejected,
        totalPaid: summary.confirmedPaid,
        pendingPaid: summary.pendingPaid,
        remaining: summary.remaining,
        isFullyPaid: summary.isFullyPaid,
    };
}
