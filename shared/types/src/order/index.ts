/**
 * Доменная модель заказа — ООП (rich entities + aggregate root, immutable).
 *
 * Главная точка входа: `OrderBook` (aggregate root) + `OrderLine` (entity).
 * Стратегии этапов (Collection / Reorder / PaymentPlus) инкапсулируют правила по стадиям.
 */
export { OrderLine } from './order-line';
export type { OrderLineProps } from './order-line';

export { OrderBook } from './order-book';
export type { AdjustResult } from './order-book';

export { getStageStrategy } from './stages';
export type { StageStrategy, PoolAggregation } from './stages';
export { CollectionStage, ReorderStage, PaymentPlusStage } from './stages';

export { computeRawPool, computePoolInfo } from './pool';
export { computeAmountDue, computeAmountDueWithPackages, computePackagePrice } from './pricing';
export { mergeLines } from './aggregation';
export { toOrderLineVO, toOrderLinesVO } from './mapping';
export type { OrderLineRowLike } from './mapping';

export type {
    OrderLineVO,
    OrderLineStatus,
    PurchaseItem,
    OrderEffect,
    OrderError,
    OrderErrorCode,
    PoolInfo,
    AggregatedOrder,
    OrderDisplayContext,
} from './types';
