/**
 * Расчёт пула добора (supplement pool).
 *
 * Три пути:
 *  1. targetRemainder задан админом → pool = targetRemainder - supplementClaimed.
 *  2. Авторасчёт по пачкам: pool = packsNeeded * packSize - totalOrdered,
 *     где packsNeeded фиксируется по замороженному baseQuantity (REORDER)
 *     или по totalOrdered (COLLECTION, до заморозки).
 *  3. orderedQty задан (шт/туба — единственный путь; гр/пачки — min с путём 2):
 *     pool = orderedQty - totalOrderedWithPackages (остаток к продаже).
 */
import type { OrderError, PoolAggregation, PoolInfo, PurchaseItem } from './types';
import { getUnitShortName } from './utils';
import { isPieceUnit } from '../units/normalize';
import { computeRawOrderedStock } from './ordered-stock';

export function computeRawPool(input: {
    targetRemainder: number | null;
    packSize: number | null;
    aggregation: PoolAggregation;
    unitCode?: string | null;
    orderedQty?: number | null;
}): number | null {
    const { targetRemainder, packSize, aggregation } = input;
    const { totalOrderedQuantity, supplementClaimed, totalBaseQuantity } = aggregation;

    const orderedPool = computeRawOrderedStock({
        orderedQty: input.orderedQty ?? null,
        aggregation,
    });

    let pool: number | null;
    if (targetRemainder != null) {
        pool = Math.max(0, targetRemainder - Math.max(0, supplementClaimed));
    } else if (isPieceUnit(input.unitCode ?? null)) {
        pool = null;
    } else if (packSize == null || packSize <= 0) {
        pool = null;
    } else {
        const baseForPacks = totalBaseQuantity > 0 ? totalBaseQuantity : totalOrderedQuantity;
        const packsNeeded = Math.max(1, Math.ceil(baseForPacks / packSize - 1e-9));
        pool = Math.max(0, packsNeeded * packSize - totalOrderedQuantity);
    }

    if (orderedPool != null) {
        pool = pool == null ? orderedPool : Math.min(pool, orderedPool);
    }
    return pool;
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
    currentQty: number;
    unitCode?: string | null;
    orderedQty?: number | null;
}): PoolInfo {
    const pool = computeRawPool({
        targetRemainder: input.targetRemainder,
        packSize: input.packSize,
        aggregation: input.aggregation,
        unitCode: input.unitCode ?? null,
        orderedQty: input.orderedQty ?? null,
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
        packSize: item.packAmount,
        aggregation,
        unitCode: item.unitCode,
        orderedQty: item.orderedQty ?? null,
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
