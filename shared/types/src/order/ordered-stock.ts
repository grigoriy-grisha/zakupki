/**
 * Расчёт остатка к продаже (ordered stock).
 *
 * orderedQty — сколько организатор заказал у поставщика и может продать
 * (в базовых единицах: гр/шт/туба). Если null — ещё не заказано,
 * ограничения нет.
 *
 * Семантика зеркальна supplierLimit (limit.ts), но по фактической закупке:
 *   - stock = max(0, orderedQty − totalOrderedWithPackages)
 *   - maxAllowed = stock + currentQty
 * Упаковки считаются проданным стоком (qty + packageCount × packSize).
 */
import { resolveUnit } from '../units/registry';
import type { OrderError, PoolAggregation, PurchaseItem } from './types';

/** Снимок остатка к продаже для конкретного пользователя (UI projection). */
export interface OrderedStockInfo {
    /** null — orderedQty не задан (без ограничения). */
    stock: number | null;
    /** Сколько максимум может иметь пользователь (stock + currentQty). */
    maxAllowed: number;
    /** Сколько ещё можно добавить этому пользователю. */
    canAddMore: number;
}

/**
 * Сырой остаток к продаже (сколько ещё можно заказать всем вместе).
 * @returns null если orderedQty не задан.
 */
export function computeRawOrderedStock(input: {
    orderedQty: number | null;
    aggregation: PoolAggregation;
}): number | null {
    const { orderedQty, aggregation } = input;
    if (orderedQty == null) return null;
    return Math.max(0, orderedQty - aggregation.totalOrderedWithPackages);
}

/**
 * Считает OrderedStockInfo для конкретного пользователя.
 *
 * maxAllowed = stock + currentQty: stock уже вычтен на
 * totalOrderedWithPackages (включая currentQty), поэтому
 * stock + currentQty = сколько пользователь может иметь максимум.
 */
export function computeOrderedStockInfo(input: {
    orderedQty: number | null;
    aggregation: PoolAggregation;
    /** Текущее количество пользователя. */
    currentQty: number;
}): OrderedStockInfo {
    const stock = computeRawOrderedStock({
        orderedQty: input.orderedQty,
        aggregation: input.aggregation,
    });

    if (stock == null) {
        return {
            stock: null,
            maxAllowed: Number.POSITIVE_INFINITY,
            canAddMore: Number.POSITIVE_INFINITY,
        };
    }

    const maxAllowed = stock + input.currentQty;
    return {
        stock,
        maxAllowed,
        canAddMore: Math.max(0, maxAllowed - input.currentQty),
    };
}

/**
 * Проверяет, не превышает ли newQty (новое qty конкретного пользователя)
 * остаток к продаже с учётом остальных пользователей.
 *
 * Возвращает `null` если валидно или orderedQty не задан.
 */
export function validateOrderedStock(
    item: PurchaseItem,
    newQty: number,
    currentQty: number,
    aggregation: PoolAggregation,
): OrderError | null {
    const orderedQty = item.orderedQty ?? null;
    const info = computeOrderedStockInfo({
        orderedQty,
        aggregation,
        currentQty,
    });
    if (orderedQty == null || info.stock == null) return null;

    if (newQty > info.maxAllowed + 1e-9) {
        const unitShort = resolveUnit(item.unitCode)?.shortName ?? 'ед.';
        return {
            code: 'stock_exceeded',
            message: formatStockExceededMessage(orderedQty, info.canAddMore, unitShort),
            canAddMore: info.canAddMore,
            unitShort,
        };
    }
    return null;
}

function formatStockExceededMessage(orderedQty: number, canAddMore: number, unitShort: string): string {
    const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, ''));
    return `Заказано у поставщика: ${fmt(orderedQty)} ${unitShort}. Доступно: ${fmt(canAddMore)} ${unitShort}`;
}
