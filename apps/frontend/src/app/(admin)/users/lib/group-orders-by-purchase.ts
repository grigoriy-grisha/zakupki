import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/server/routers/_app';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type UserOrderLine = RouterOutputs['orders']['getByUser'][number];

export type UserPurchaseGroup = {
    purchaseId: number;
    tag: string;
    supplier: string | null;
    orders: UserOrderLine[];
    totalDue: number;
};

export function groupOrdersByPurchase(orders: UserOrderLine[]): UserPurchaseGroup[] {
    const map = new Map<number, UserPurchaseGroup>();

    for (const order of orders) {
        const purchase = order.purchaseItem?.purchase;
        const purchaseId = purchase?.id ?? order.purchaseItem?.purchaseId;
        if (!purchaseId) continue;

        const existing = map.get(purchaseId) ?? {
            purchaseId,
            tag: purchase?.tag ?? `Закупка #${purchaseId}`,
            supplier: purchase?.supplier ?? null,
            orders: [],
            totalDue: 0,
        };

        existing.orders.push(order);
        existing.totalDue += Number(order.amountDue);
        if (purchase?.tag) existing.tag = purchase.tag;
        if (purchase?.supplier) existing.supplier = purchase.supplier;

        map.set(purchaseId, existing);
    }

    return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
}

export function countUniquePurchases(
    orderLines: { purchaseItem?: { purchaseId: number } | null }[],
): number {
    const ids = new Set<number>();
    for (const line of orderLines) {
        const pid = line.purchaseItem?.purchaseId;
        if (pid != null) ids.add(pid);
    }
    return ids.size;
}
