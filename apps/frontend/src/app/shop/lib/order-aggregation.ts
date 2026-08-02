/**
 * Агрегация строк заказа юзера для shop-UI.
 *
 * Юзер видит 1 запись на товар, даже если в БД две строки:
 * COLLECTION (замороженная база) + REORDER (добор, опционально с упаковками).
 *
 * Использует доменный mergeLines (shared) — единая логика с ботом и админкой.
 */
import { mergeLines, toOrderLinesVO } from '@zakupki/types';

/** Минимальный интерфейс orderLine для агрегации в shop. Поля приходят из tRPC (Decimal→string). */
export interface AggregatableOrderLine {
    id: number;
    purchaseItemId: number;
    quantity?: unknown;
    amountDue: unknown;
    packageCount?: unknown;
    baseQuantity?: unknown;
    basePackageCount?: unknown;
    createdOnStage?: string | null;
}

export interface AggregatedForUser {
    /** Сумма quantity всех строк (COLLECTION + REORDER). */
    quantity: number;
    /** Сумма amountDue всех строк. */
    amountDue: number;
    /** Сумма packageCount всех строк (COLLECTION + REORDER-pkg). */
    packageCount: number;
    /** baseQuantity из COLLECTION-строки (замороженный снимок). */
    baseQuantity: number;
    /** basePackageCount из COLLECTION-строки (замороженный снимок). */
    basePackageCount: number;
    /** Оригинальные ID строк. */
    lineIds: number[];
}

/** Агрегировать все строки юзера по одному purchaseItemId. */
export function aggregateUserLines(lines: AggregatableOrderLine[], purchaseItemId: number): AggregatedForUser {
    const filtered = lines.filter((l) => l.purchaseItemId === purchaseItemId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = mergeLines(toOrderLinesVO(filtered as any));
    return {
        quantity: merged.quantity,
        amountDue: merged.amountDue,
        packageCount: merged.packageCount,
        baseQuantity: merged.baseQuantity,
        basePackageCount: merged.basePackageCount,
        lineIds: merged.lineIds,
    };
}

/** Сгруппировать все строки юзера по purchaseItemId. Возвращает Map. */
export function aggregateByItem(lines: AggregatableOrderLine[]): Map<number, AggregatedForUser> {
    const byItem = new Map<number, AggregatableOrderLine[]>();
    for (const l of lines) {
        const arr = byItem.get(l.purchaseItemId) ?? [];
        arr.push(l);
        byItem.set(l.purchaseItemId, arr);
    }
    const result = new Map<number, AggregatedForUser>();
    for (const [itemId, arr] of byItem) {
        result.set(itemId, aggregateUserLines(arr, itemId));
    }
    return result;
}
