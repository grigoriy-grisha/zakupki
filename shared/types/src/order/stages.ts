/**
 * Правила этапов закупки (плоский config).
 *
 * В v3:
 *  - `StageConfig` — плоский конфиг этапа (6 булевых + 1 enum).
 *  - `getStageConfig(stage)` — O(1) lookup.
 *  - `aggregateForPool` ПЕРЕЕХАЛ в `strategies/atomic.ts` (нужен и стратегиям, и order-display).
 *  - `getStageStrategy` shim ПЕРЕЕХАЛ в `strategies/stage-strategy.ts`.
 *
 * Сам StageConfig остаётся здесь — это «domain knowledge» этапа, общий для
 * стратегий (через `getStageConfig()`) и для `order-display.ts` (через
 * `cfg.canAddPackages` и т.п.).
 */
import type { PurchaseFulfillmentStatus } from '../index';
import type { PoolAggregation } from './types';

// ── Public types ────────────────────────────────────────────────────

/** Тип целевой строки для adjust. */
export type TargetLineType = 'base' | 'supplement';

/** Поведение при qty→0: hard_delete (убрать строку) или zero_out (оставить с qty=0). */
export type ZeroQuantityAction = 'hard_delete' | 'zero_out';

/** Плоский конфиг этапа — заменяет 3 OOP-класса. */
export interface StageConfig {
    /** Куда пишет `adjust` по умолчанию. */
    target: TargetLineType;
    /** Что делать при qty→0. */
    onZero: ZeroQuantityAction;
    /** Применим ли пул добора. */
    poolApplies: boolean;
    /** Можно ли на этом этапе добавлять упаковки. */
    canAddPackages: boolean;
    /** Можно ли создать новую строку заказа на этом этапе. */
    canAddNew: boolean;
    /** Можно ли увеличить существующую строку заказа на этом этапе. */
    canIncrease: boolean;
    /** Можно ли уменьшить существующую строку заказа на этом этапе. */
    canDecrease: boolean;
}

// ── Stage config table (вместо классов) ─────────────────────────────

const COLLECTION_CONFIG: StageConfig = {
    target: 'base',
    onZero: 'hard_delete',
    poolApplies: false,
    canAddPackages: true,
    canAddNew: true,
    canIncrease: true,
    canDecrease: true,
};

const REORDER_CONFIG: StageConfig = {
    target: 'base',
    onZero: 'hard_delete',
    poolApplies: true,
    canAddPackages: true,
    canAddNew: true,
    canIncrease: true,
    canDecrease: true,
};

const PAYMENT_PLUS_CONFIG: StageConfig = {
    target: 'supplement',
    onZero: 'hard_delete',
    poolApplies: true,
    canAddPackages: false,
    canAddNew: true,
    canIncrease: true,
    canDecrease: true,
};

const STAGE_CONFIGS: Record<PurchaseFulfillmentStatus, StageConfig> = {
    COLLECTION: COLLECTION_CONFIG,
    REORDER: REORDER_CONFIG,
    PAYMENT: PAYMENT_PLUS_CONFIG,
    SUPPLIER_ASSEMBLY: PAYMENT_PLUS_CONFIG,
    PREPARING_SHIPMENT_RF: PAYMENT_PLUS_CONFIG,
    IN_TRANSIT_RF: PAYMENT_PLUS_CONFIG,
    IN_TRANSIT_TO_ORGANIZER: PAYMENT_PLUS_CONFIG,
    PACKAGING: PAYMENT_PLUS_CONFIG,
    READY_FOR_PICKUP: PAYMENT_PLUS_CONFIG,
};

/** Получить конфиг этапа. O(1) lookup. */
export function getStageConfig(stage: PurchaseFulfillmentStatus): StageConfig {
    return STAGE_CONFIGS[stage];
}
