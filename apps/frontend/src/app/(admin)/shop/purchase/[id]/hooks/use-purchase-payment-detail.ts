'use client';

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
    const hasPending = purchasePayments.some((p) => (p as { status: string }).status === 'PENDING');
    const hasRejected = purchasePayments.some((p) => (p as { status: string }).status === 'REJECTED');

    const totalPaid = purchasePayments
        .filter((p) => {
            const status = (p as { status: string }).status;
            return status === 'CONFIRMED' || status === 'PENDING';
        })
        .reduce((sum, p) => {
            const children = (p as { children?: { amount: unknown }[] }).children ?? [];
            const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
            return sum + Number(p.amount) + childAmount;
        }, 0);

    const remaining = Math.max(0, totalDue - totalPaid);

    return {
        myOrders,
        myOrdersInPurchase,
        totalDue,
        purchasePayments,
        hasPending,
        hasRejected,
        totalPaid,
        remaining,
    };
}
