import { summarizePurchasePayments } from '@/components/shop/payment-proof';
import { trpc } from '@/lib/client/trpc';

export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    pendingPaid: number;
    hasPending: boolean;
    remaining: number;
    isFullyPaid: boolean;
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
        const existing = map.get(pid) ?? {
            due: 0,
            paid: 0,
            pendingPaid: 0,
            hasPending: false,
            remaining: 0,
            isFullyPaid: false,
        };
        existing.due += Number(o.amountDue);
        map.set(pid, existing);
    });

    const paymentsByPurchase = new Map<number, typeof myPayments>();
    myPayments?.forEach((p) => {
        const list = paymentsByPurchase.get(p.purchaseId) ?? [];
        list.push(p);
        paymentsByPurchase.set(p.purchaseId, list);
    });

    map.forEach((val, pid) => {
        const summary = summarizePurchasePayments(val.due, paymentsByPurchase.get(pid) ?? []);
        val.paid = summary.confirmedPaid;
        val.pendingPaid = summary.pendingPaid;
        val.hasPending = summary.hasPending;
        val.remaining = summary.remaining;
        val.isFullyPaid = summary.isFullyPaid;
    });

    return { map, myOrders, myPayments };
}
