'use client';

import type { PurchaseItem } from '../../lib/types';
import { PackingItemCard } from './packing-item-card';

interface PackingTabProps {
    purchaseId: number;
    items: PurchaseItem[];
}

/** Вкладка «Фасовка»: одна карточка PackingItemCard на каждую позицию с активными заказами. */
export function PackingTab({ purchaseId, items }: PackingTabProps) {
    const itemsWithOrders = items.filter((it) =>
        it.orderLines.some((l) => Number(l.quantity) > 0 || Number(l.packageCount ?? 0) > 0),
    );

    if (itemsWithOrders.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-bg-card p-6 text-center text-13-regular text-fg-tertiary">
                Пока никто ничего не заказал — фасовка не нужна
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {itemsWithOrders.map((item) => (
                <PackingItemCard key={item.id} purchaseId={purchaseId} item={item} />
            ))}
        </div>
    );
}
