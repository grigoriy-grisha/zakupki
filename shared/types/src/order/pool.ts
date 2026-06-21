/**
 * Расчёт пула добора (supplement pool).
 *
 * Два пути:
 *  1. targetRemainder задан админом → pool = targetRemainder - supplementClaimed.
 *  2. Авторасчёт по пачкам: pool = packsNeeded * packSize - totalOrdered,
 *     где packsNeeded фиксируется по замороженному baseQuantity (REORDER)
 *     или по totalOrdered (COLLECTION, до заморозки).
 */
import type { OrderError, PoolAggregation, PoolInfo, PurchaseItem } from './types';
import { getUnitShortName } from './utils';

/**
 * Считает «сырой» пул (сколько остатка доступно всем вместе) без привязки
 * к конкретному пользователю.
 *
 * @returns null если ограничений нет (нет ни targetRemainder, ни packSize).
 */
export function computeRawPool(input: {
    targetRemainder: number | null;
    packSize: number | null;
    aggregation: PoolAggregation;
}): number | null {
    const { targetRemainder, packSize, aggregation } = input;
    const { totalOrderedQuantity, supplementClaimed, totalBaseQuantity } = aggregation;

    // Путь 1: админский лимит — вычитаем то, что уже добрали
    if (targetRemainder != null) {
        return Math.max(0, targetRemainder - Math.max(0, supplementClaimed));
    }

    // Путь 2: авторасчёт по остатку от замороженных пачек
    if (packSize == null || packSize <= 0) return null;

    // Пачки фиксируются по замороженному baseQuantity.
    // Если baseQuantity ещё не заморожен (COLLECTION) — считаем от текущего total.
    const baseForPacks = totalBaseQuantity > 0 ? totalBaseQuantity : totalOrderedQuantity;
    const packsNeeded = Math.max(1, Math.ceil(baseForPacks / packSize - 1e-9));
    return Math.max(0, packsNeeded * packSize - totalOrderedQuantity);
}

/**
 * Считает PoolInfo для конкретного пользователя.
 *
 * maxAllowed = pool + currentQty: пул уже вычтен на supplementClaimed
 * (включая этого пользователя), поэтому pool + currentQty = сколько
 * пользователь может иметь максимум.
 */
export function computePoolInfo(input: {
    targetRemainder: number | null;
    packSize: number | null;
    aggregation: PoolAggregation;
    /** Текущее количество пользователя (для canAddMore). */
    currentQty: number;
}): PoolInfo {
    const pool = computeRawPool({
        targetRemainder: input.targetRemainder,
        packSize: input.packSize,
        aggregation: input.aggregation,
    });

    if (pool == null) {
        return {
            pool: null,
            maxAllowed: Number.POSITIVE_INFINITY,
            canAddMore: Number.POSITIVE_INFINITY,
            supplementClaimed: input.aggregation.supplementClaimed,
            totalBaseQuantity: input.aggregation.totalBaseQuantity,
            totalOrderedQuantity: input.aggregation.totalOrderedQuantity,
            totalOrderedWithPackages: input.aggregation.totalOrderedWithPackages,
        };
    }

    const maxAllowed = pool + input.currentQty;
    const canAddMore = Math.max(0, maxAllowed - input.currentQty);
    return {
        pool,
        maxAllowed,
        canAddMore,
        supplementClaimed: input.aggregation.supplementClaimed,
        totalBaseQuantity: input.aggregation.totalBaseQuantity,
        totalOrderedQuantity: input.aggregation.totalOrderedQuantity,
        totalOrderedWithPackages: input.aggregation.totalOrderedWithPackages,
    };
}

/**
 * Проверяет, не превышает ли newQty доступный пул. `maxAllowed = pool + currentQty`
 * (пул уже вычтен на supplementClaimed включая этого пользователя).
 * Возвращает `null` если валидно или ограничений нет.
 */
export function validateSupplementPool(
    item: PurchaseItem,
    newQty: number,
    currentQty: number,
    aggregation: PoolAggregation,
): OrderError | null {
    const pool = computeRawPool({
        targetRemainder: item.targetRemainder,
        packSize: item.supplierPackageAmount,
        aggregation,
    });
    if (pool == null) return null;

    const maxAllowed = pool + currentQty;
    if (newQty > maxAllowed + 1e-9) {
        const canAddMore = Math.max(0, maxAllowed - currentQty);
        const unitShort = getUnitShortName(item.unitCode);
        return {
            code: 'pool_exceeded',
            message: formatPoolExceededMessage(canAddMore, unitShort),
            canAddMore,
            unitShort,
        };
    }
    return null;
}

function formatPoolExceededMessage(canAddMore: number, unitShort: string): string {
    const formatted = canAddMore % 1 === 0 ? String(canAddMore) : canAddMore.toFixed(3).replace(/\.?0+$/, '');
    return `Нельзя добавить больше остатка. Можно ещё: ${formatted} ${unitShort}`;
}
