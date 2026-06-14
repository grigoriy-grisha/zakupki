/**
 * Расчёт глобального лимита остатка у поставщика (supplier limit).
 *
 * supplierLimit — максимум, который СУММАРНО все пользователи могут заказать
 * (в ед. supplierLimitUnit). Если null — без ограничений.
 *
 * Семантика похожа на пул добора (`pool.ts`):
 *   - poolFor(user) = max(0, supplierLimit - totalOrderedQuantity) + currentUserQty
 *   - canAddMore = max(0, supplierLimit - totalOrderedQuantity)  // одинаков для всех
 *
 * Применяется на ВСЕХ этапах (COLLECTION, REORDER, PAYMENT+).
 */
import type { OrderError, PoolAggregation, PurchaseItem } from './types';
import { resolveUnit } from '../units/registry';

/** Снимок остатка supplierLimit для конкретного пользователя (UI projection). */
export interface SupplierLimitInfo {
    /** null — лимит не задан (без ограничений). */
    supplierPool: number | null;
    /** Сколько максимум может иметь пользователь (supplierPool + currentQty). */
    maxAllowed: number;
    /** Сколько ещё можно добавить этому пользователю. */
    canAddMore: number;
}

/**
 * Считает «сырой» остаток supplierLimit (сколько ещё можно добрать всем вместе)
 * без привязки к конкретному пользователю.
 *
 * @returns null если ограничений нет (supplierLimit == null).
 */
export function computeRawSupplierLimit(input: {
    supplierLimit: number | null;
    aggregation: PoolAggregation;
}): number | null {
    const { supplierLimit, aggregation } = input;
    if (supplierLimit == null) return null;
    return Math.max(0, supplierLimit - aggregation.totalOrderedQuantity);
}

/**
 * Считает SupplierLimitInfo для конкретного пользователя.
 *
 * maxAllowed = supplierPool + currentQty: supplierPool уже вычтен на
 * totalOrderedQuantity (включая currentQty), поэтому supplierPool + currentQty
 * = сколько пользователь может иметь максимум.
 */
export function computeSupplierLimitInfo(input: {
    supplierLimit: number | null;
    aggregation: PoolAggregation;
    /** Текущее количество пользователя. */
    currentQty: number;
}): SupplierLimitInfo {
    const supplierPool = computeRawSupplierLimit({
        supplierLimit: input.supplierLimit,
        aggregation: input.aggregation,
    });

    if (supplierPool == null) {
        return {
            supplierPool: null,
            maxAllowed: Number.POSITIVE_INFINITY,
            canAddMore: Number.POSITIVE_INFINITY,
        };
    }

    const maxAllowed = supplierPool + input.currentQty;
    return {
        supplierPool,
        maxAllowed,
        canAddMore: Math.max(0, maxAllowed - input.currentQty),
    };
}

/**
 * Проверяет, не превышает ли newQty (новое qty конкретного пользователя)
 * глобальный лимит supplierLimit с учётом остальных пользователей.
 *
 * maxAllowed = pool + currentQty, где pool = supplierLimit - totalOrderedQuantity.
 * Поскольку pool уже вычтен на totalOrderedQuantity (включая currentQty),
 * `pool + currentQty` = сколько пользователь может иметь максимум.
 *
 * Возвращает `null` если валидно или ограничение не задано.
 */
export function validateSupplierLimit(
    item: PurchaseItem,
    newQty: number,
    currentQty: number,
    aggregation: PoolAggregation,
): OrderError | null {
    const info = computeSupplierLimitInfo({
        supplierLimit: item.supplierLimit,
        aggregation,
        currentQty,
    });
    if (info.supplierPool == null) return null;

    if (newQty > info.maxAllowed + 1e-9) {
        const canAddMore = info.canAddMore;
        const unitShort = resolveUnit(item.supplierLimitUnit ?? item.unitCode)?.shortName ?? 'ед.';
        return {
            code: 'limit_exceeded',
            message: formatLimitExceededMessage(item.supplierLimit as number, canAddMore, unitShort),
            canAddMore,
            unitShort,
        };
    }
    return null;
}

function formatLimitExceededMessage(limit: number, canAddMore: number, unitShort: string): string {
    const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, ''));
    return `Лимит поставщика: ${fmt(limit)} ${unitShort}. Доступно: ${fmt(canAddMore)} ${unitShort}`;
}
