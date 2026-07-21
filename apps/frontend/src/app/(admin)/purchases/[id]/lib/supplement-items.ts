import { computeRawPool, getStageStrategy, toOrderLinesVO } from '@zakupki/types';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import type { PurchaseItem } from './types';

/**
 * Товар попадает на вкладку «Доборы», если у него есть supplier pack
 * (т.е. можно автоматически вычислить свободный остаток от последней пачки)
 * ИЛИ админ явно выставил targetRemainder > 0.
 */
export function isOnRemainder(item: PurchaseItem): boolean {
    const hasPack = item.packAmount != null && Number(item.packAmount) > 0;
    const hasManual = item.targetRemainder != null && Number(item.targetRemainder) > 0;
    return hasPack || hasManual;
}

/**
 * Свободный остаток для добора: computeRawPool от targetRemainder,
 * packSize и стратегии-агрегации заказов для текущего fulfillment-этапа.
 */
export function computeFreeRemainder(
    item: PurchaseItem,
    fulfillmentStatus: PurchaseFulfillmentStatus,
): number | null {
    const packSize = item.packAmount != null ? Number(item.packAmount) : null;
    const strategy = getStageStrategy(fulfillmentStatus);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aggregation = strategy.aggregateForPool(toOrderLinesVO((item.orderLines ?? []) as any));
    return computeRawPool({
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        packSize,
        aggregation,
    });
}
