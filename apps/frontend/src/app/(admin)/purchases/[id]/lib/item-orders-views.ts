/**
 * Чистая логика вкладки «Разбор»: сборка представлений по товарам
 * (пропорциональное покрытие оплатами, собрано/остаток, последняя строка)
 * и фильтрация (чипсы + поиск; товары — по алфавиту, строки — свежие сверху).
 */
import { paymentTotal } from '@/lib/payment-utils';

import { getCollectedQty, getRemainderQty, getUnitPriceWithDeliveryRub } from './items-table-pricing';
import type { OrderLineRef, PurchaseDetail, PurchaseItem } from './types';

export type ItemFilter = 'with_orders' | 'all' | 'deficit' | 'supplement';

export const ITEM_ORDERS_FILTERS: { id: ItemFilter; label: string }[] = [
    { id: 'with_orders', label: 'С заказами' },
    { id: 'deficit', label: 'Дефицит' },
    { id: 'supplement', label: 'С добором' },
    { id: 'all', label: 'Все' },
];

export interface ItemOrdersView {
    item: PurchaseItem;
    lines: OrderLineRef[];
    collected: number;
    remainder: number | null;
    totalDue: number;
    covered: number;
    lastAddedAt: Date | null;
    unitPriceRub: number | null;
    hasSupplement: boolean;
    isDeficit: boolean;
}

export function buildItemOrdersViews(
    items: PurchaseItem[],
    purchase: PurchaseDetail,
    orgFeeDefaultPercent: number,
): ItemOrdersView[] {
    const shareByUser = buildPaidShares(items, purchase);
    const currencyRates = purchase.currencyRates ?? [];
    const deliveryPercent = Number(purchase.deliveryPercent ?? 0);

    return items.map((item) => {
        const lines = activeLinesSorted(item);
        const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue ?? 0), 0);
        const covered = lines.reduce(
            (sum, l) => sum + Number(l.amountDue ?? 0) * (shareByUser.get(l.userId) ?? 0),
            0,
        );
        const remainder = getRemainderQty(item, purchase.fulfillmentStatus);
        return {
            item,
            lines,
            collected: getCollectedQty(item),
            remainder,
            totalDue,
            covered,
            lastAddedAt: lines.length > 0 ? new Date(lines[0].createdAt) : null,
            unitPriceRub: getUnitPriceWithDeliveryRub(item, currencyRates, orgFeeDefaultPercent, deliveryPercent),
            hasSupplement: lines.some((l) => (l.createdOnStage ?? 'COLLECTION') !== 'COLLECTION'),
            isDeficit: remainder != null && remainder > 1e-9,
        };
    });
}

export function filterItemOrdersViews(
    views: ItemOrdersView[],
    filter: ItemFilter,
    search: string,
): ItemOrdersView[] {
    const q = search.trim().toLowerCase();
    return views
        .filter((v) => {
            if (filter === 'with_orders' && v.lines.length === 0) return false;
            if (filter === 'deficit' && !v.isDeficit) return false;
            if (filter === 'supplement' && !v.hasSupplement) return false;
            if (!q) return true;
            const it = v.item;
            const haystack =
                `${it.product.name ?? ''} ${it.product.brand ?? ''} ${it.product.articleNumber ?? ''} ${it.adminComment ?? ''}`.toLowerCase();
            return haystack.includes(q);
        })
        .sort((a, b) => {
            const byName = (a.item.product.name ?? '').localeCompare(b.item.product.name ?? '', 'ru');
            return byName !== 0 ? byName : a.item.id - b.item.id;
        });
}

/** Доля оплаты участника: min(1, подтверждено / должен) — для пропорционального «Покрыто». */
function buildPaidShares(items: PurchaseItem[], purchase: PurchaseDetail): Map<number, number> {
    const paidByUser = new Map<number, number>();
    for (const p of purchase.payments ?? []) {
        if (p.status !== 'CONFIRMED') continue;
        paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + paymentTotal(p));
    }

    const dueByUser = new Map<number, number>();
    for (const item of items) {
        for (const line of item.orderLines) {
            if (line.status === 'CANCELLED') continue;
            dueByUser.set(line.userId, (dueByUser.get(line.userId) ?? 0) + Number(line.amountDue ?? 0));
        }
    }

    const shareByUser = new Map<number, number>();
    for (const [userId, due] of dueByUser) {
        if (due <= 0) continue;
        shareByUser.set(userId, Math.min(1, (paidByUser.get(userId) ?? 0) / due));
    }
    return shareByUser;
}

/** Активные строки товара, последние добавленные раньше (id — тай-брейк). */
function activeLinesSorted(item: PurchaseItem): OrderLineRef[] {
    return item.orderLines
        .filter((l) => l.status !== 'CANCELLED')
        .slice()
        .sort((a, b) => {
            const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return diff !== 0 ? diff : b.id - a.id;
        });
}
