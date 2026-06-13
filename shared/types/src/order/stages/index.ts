/**
 * Стратегии по этапам закупки.
 *
 * Каждый этап (COLLECTION / REORDER / PAYMENT+) инкапсулирует свои правила:
 *  - что можно делать (add/increase/decrease)
 *  - с какой строкой работать (base COLLECTION vs supplement)
 *  - что делать при обнулении (hard delete vs zero-out)
 *  - как считать пул и агрегировать строки
 *
 * Паттерн Strategy: OrderBook выбирает стратегию через getStageStrategy()
 * и делегирует ей все решения — никаких if/else по статусам в фасаде.
 */
import type { PURCHASE_FULFILLMENT_STATUSES } from '../../index';
import type { OrderError, OrderLineVO, PurchaseItem } from '../types';
import type { PurchaseFulfillmentStatus } from '../../index';

import { CollectionStage } from './collection.stage';
import { PaymentPlusStage } from './payment-plus.stage';
import { ReorderStage } from './reorder.stage';
import { computeRawPool } from '../pool';
import { getUnitShortName } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Statuses = (typeof PURCHASE_FULFILLMENT_STATUSES)[number];

export type TargetLineType = 'base' | 'supplement';

export type ZeroQuantityAction = 'hard_delete' | 'zero_out';

export interface PoolAggregation {
    totalBaseQuantity: number;
    supplementClaimed: number;
    totalOrderedQuantity: number;
}

export interface StageStrategy {
    /** Этап закупки. */
    readonly stage: PurchaseFulfillmentStatus;

    // ── Permissions ──
    canAddNew(): boolean;
    canIncrease(): boolean;
    canDecrease(): boolean;
    canAddPackages(): boolean;

    // ── Тип строки для операций изменения количества ──
    readonly targetLineType: TargetLineType;

    // ── Поведение при обнулении количества ──
    onZeroQuantity(line: OrderLineVO | null): ZeroQuantityAction;

    // ── Пул добора ──
    /** Применим ли пул на этом этапе. */
    poolApplies(): boolean;
    /** Агрегация строк для расчёта пула (зависит от этапа). */
    aggregateForPool(lines: OrderLineVO[]): PoolAggregation;
    /**
     * Валидация: не превышает ли newQty доступный пул.
     * null — валидно. OrderError — нарушение.
     */
    validatePool(
        item: PurchaseItem,
        userId: number,
        newQty: number,
        currentQty: number,
        aggregation: PoolAggregation,
    ): OrderError | null;

    // ── Ограничения на убавку ──
    /**
     * Минимальное количество, до которого пользователь может убавить.
     * PAYMENT+: нельзя ниже baseQuantity. COLLECTION/REORDER: 0.
     */
    minDecreaseQuantity(userId: number, lines: OrderLineVO[]): number;
}

// ── Вспомогательные функции для строк (устарели — OrderBook.baseLineFor/supplementLineFor/activeLines покрывают) ──

/**
 * Фабрика стратегий: выбирает стратегию по статусу закупки.
 * COLLECTION → CollectionStage, REORDER → ReorderStage, PAYMENT+ → PaymentPlusStage.
 */
export function getStageStrategy(stage: PurchaseFulfillmentStatus): StageStrategy {
    if (stage === 'COLLECTION') return new CollectionStage();
    if (stage === 'REORDER') return new ReorderStage();
    return new PaymentPlusStage();
}

// ── Общий helper для валидации пула (используется REORDER и PAYMENT+) ──

/**
 * Проверяет, не превышает ли newQty доступный пул. Логика идентична для
 * REORDER и PAYMENT+: maxAllowed = pool + currentQty (пул уже вычтен
 * на supplementClaimed включая этого пользователя).
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

export { CollectionStage, ReorderStage, PaymentPlusStage };
