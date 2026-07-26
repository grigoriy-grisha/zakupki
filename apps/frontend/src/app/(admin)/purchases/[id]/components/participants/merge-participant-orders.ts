import { mergeLines, toOrderLinesVO } from '@zakupki/types';

import type { ParticipantOrder } from './types';

/**
 * Объединённое представление строк участника для одного PurchaseItem
 * (COLLECTION + supplement слиты воедино для отображения одной позицией).
 *
 * quantity/amountDue/packageCount — суммы по всем строкам пользователя на item.
 */
export interface MergedParticipantOrder {
    purchaseItemId: number;
    /** Сумма quantity всех строк (россыпь, без упаковок). */
    quantity: number;
    /** Сумма amountDue всех строк. */
    amountDue: number;
    /** Сумма packageCount всех строк (явные упаковки). */
    packageCount: number;
    /** Оригинальные ID строк (для потенциальных углублённых действий). */
    lineIds: number[];
    /** Первая строка — для доступа к purchaseItem/product (одинаковый у всех строк группы). */
    source: ParticipantOrder;
}

/**
 * Группирует строки одного участника по purchaseItemId через доменную `mergeLines`
 * (единую логику с ботом и магазином). Строки COLLECTION + supplement для одного
 * товара схлопываются в одну запись для отображения карточкой.
 *
 * Возвращает массив, сохраняющий порядок первого вхождения каждого purchaseItemId.
 */
export function mergeParticipantOrders(orders: ParticipantOrder[]): MergedParticipantOrder[] {
    const byItem = new Map<number, { source: ParticipantOrder; lines: ParticipantOrder[] }>();

    for (const order of orders) {
        let entry = byItem.get(order.purchaseItemId);
        if (!entry) {
            entry = { source: order, lines: [] };
            byItem.set(order.purchaseItemId, entry);
        }
        entry.lines.push(order);
    }

    return Array.from(byItem.values()).map(({ source, lines }) => {
        const aggregated = mergeLines(toOrderLinesVO(lines));
        return {
            purchaseItemId: source.purchaseItemId,
            quantity: aggregated.quantity,
            amountDue: aggregated.amountDue,
            packageCount: aggregated.packageCount,
            lineIds: aggregated.lineIds,
            source,
        };
    });
}
