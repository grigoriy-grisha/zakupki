/**
 * Доменная модель заказа — ООП (rich entities + aggregate root, immutable).
 *
 * Главная точка входа: `OrderBook` (aggregate root) + `OrderLine` (entity).
 * Правила этапов (Collection / Reorder / PaymentPlus) — плоские данные в `./stages`.
 * Мутации строк — ООП Strategy в `./strategies`.
 * UI-контекст — pure projection в `./order-display`.
 */
export { OrderLine } from './order-line';
export type { OrderLineProps } from './order-line';

export { OrderBook } from './order-book';
export type { AdjustResult } from './order-book';

export { getStageConfig } from './stages';
export type { StageConfig, TargetLineType, ZeroQuantityAction } from './stages';

// StageStrategy (ООП стратегии по стадиям закупки)
export { StageStrategy, BaseMutableStrategy, getStageStrategy } from './strategies/stage-strategy';
export type { StageStrategyShim } from './strategies/stage-strategy';
export {
    CollectionStrategy,
    ReorderStrategy,
    PaymentPlusStrategy,
    makeStrategy,
} from './strategies/concrete-strategies';

// Internal-типы (нужны OrderBook, экспортируются для совместимости)
export type { LineUpdate, MultiUpdate } from './strategies/atomic';
export { applyUpdates } from './strategies/atomic';

export { buildDisplayContext } from './order-display';

export { computeRawPool, computePoolInfo, validateSupplementPool } from './pool';
export { computeRawSupplierLimit, computeSupplierLimitInfo, validateSupplierLimit } from './limit';
export type { SupplierLimitInfo } from './limit';
export { aggregateForPool } from './strategies/atomic';
export { computeAmountDue, computeAmountDueWithPackages, computePackagePrice } from './pricing';
export { mergeLines } from './aggregation';
export { effectiveQty, sumEffectiveQty, userEffectiveQty, totalOrderedQuantity } from './order-math';
export { toOrderLineVO, toOrderLinesVO, mapToPurchaseItem } from './mapping';
export type { OrderLineRowLike, PurchaseItemRowLike } from './mapping';

export type {
    OrderLineVO,
    OrderLineStatus,
    PurchaseItem,
    OrderEffect,
    OrderError,
    OrderErrorCode,
    PoolAggregation,
    PoolInfo,
    AggregatedOrder,
    OrderDisplayContext,
} from './types';
