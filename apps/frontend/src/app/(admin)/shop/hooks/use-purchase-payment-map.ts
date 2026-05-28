import { trpc } from '@/lib/client/trpc';

export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    hasPending: boolean;
    remaining: number;
};

/**
 * Builds a map of purchaseId → payment summary across all purchases.
 * Used on the shop listing page to show payment status per purchase.
 */
export function usePurchasePaymentMap() {
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    const map = new Map<number, PurchasePaymentInfo>();

    // Sum orders per purchase
    myOrders?.forEach((o) => {
        const pid = o.purchaseItem?.purchaseId;
        if (!pid) return;
        const existing = map.get(pid) ?? { due: 0, paid: 0, hasPending: false, remaining: 0 };
        existing.due += Number(o.amountDue);
        map.set(pid, existing);
    });

    // Sum payments per purchase
    myPayments?.forEach((p) => {
        const pid = p.purchaseId;
        const status = (p as { status: string }).status;
        const children = (p as { children?: { amount: unknown }[] }).children ?? [];
        const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
        const total = Number(p.amount) + childAmount;

        const existing = map.get(pid) ?? { due: 0, paid: 0, hasPending: false, remaining: 0 };
        if (status === 'CONFIRMED' || status === 'PENDING') {
            existing.paid += total;
        }
        if (status === 'PENDING') {
            existing.hasPending = true;
        }
        map.set(pid, existing);
    });

    // Calculate remaining
    map.forEach((val) => {
        val.remaining = Math.max(0, val.due - val.paid);
    });

    return { map, myOrders, myPayments };
}

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
