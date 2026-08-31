// Shared types for the zakupki project

export type PurchaseStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARRIVED' | 'DONE';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активная',
    CLOSED: 'Закрыта',
    ARRIVED: 'Прибыла',
    DONE: 'Завершена',
};

/** Zakupka zavershena organizatorom — zakazy ukhodyat v «proshlye». */
export function isPurchaseCompleted(status: PurchaseStatus | string | null | undefined): boolean {
    return status === 'DONE';
}

// Handoff statuses — выдача заказа участнику (живёт на PurchaseOrder)
export const HANDOFF_STATUSES = ['SENT', 'RECEIVED', 'STORED'] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_STATUS_LABELS: Record<HandoffStatus, string> = {
    SENT: 'Отправлен',
    RECEIVED: 'Получение подтверждено',
    STORED: 'Отложен на хранение',
};

export const HANDOFF_DEFAULT_LABEL = 'Ожидает выдачи';

// Fulfillment statuses
export const PURCHASE_FULFILLMENT_STATUSES = [
    'COLLECTION',
    'REORDER',
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
] as const;

export type PurchaseFulfillmentStatus = (typeof PURCHASE_FULFILLMENT_STATUSES)[number];

export const PURCHASE_FULFILLMENT_LABELS: Record<PurchaseFulfillmentStatus, string> = {
    COLLECTION: 'Сбор заказов',
    REORDER: 'Доборы',
    PAYMENT: 'Оплата заказов',
    SUPPLIER_ASSEMBLY: 'Комплектация',
    PREPARING_SHIPMENT_RF: 'Отправка в РФ',
    IN_TRANSIT_RF: 'Едет в РФ',
    IN_TRANSIT_TO_ORGANIZER: 'До организатора',
    PACKAGING: 'Фасовка',
    READY_FOR_PICKUP: 'К выдаче',
};

/** Oplata dostupna na etape PAYMENT i vsekh posleduyushchikh. */
export function isPurchasePaymentOpen(status: PurchaseFulfillmentStatus | null | undefined): boolean {
    const current = (status ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const idx = PURCHASE_FULFILLMENT_STATUSES.indexOf(current);
    const paymentIdx = PURCHASE_FULFILLMENT_STATUSES.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

// Order domain — ООП (rich entities + aggregate root)
export {
    OrderLine,
    OrderBook,
    getStageConfig,
    aggregateForPool,
    getStageStrategy,
    validateSupplementPool,
    computeRawPool,
    computePoolInfo,
    computeRawSupplierLimit,
    computeSupplierLimitInfo,
    validateSupplierLimit,
    computeAmountDue,
    computeAmountDueWithPackages,
    computePackagePrice,
    computeUnitPriceRubNewModel,
    mergeLines,
    toOrderLineVO,
    toOrderLinesVO,
    mapToPurchaseItem,
    // ООП StageStrategy (v3)
    StageStrategy,
    makeStrategy,
    CollectionStrategy,
    ReorderStrategy,
    PaymentPlusStrategy,
    effectiveQty,
    sumEffectiveQty,
    userEffectiveQty,
    totalOrderedQuantity,
    getUnitShortName,
} from './order';
export type {
    StageConfig,
    TargetLineType,
    ZeroQuantityAction,
    LineUpdate,
    MultiUpdate,
    PoolAggregation,
    OrderLineVO,
    OrderLineProps,
    OrderLineStatus,
    AdjustResult,
    PurchaseItem,
    OrderEffect,
    OrderError,
    OrderErrorCode,
    PoolInfo,
    AggregatedOrder,
    OrderDisplayContext,
    OrderLineRowLike,
    PurchaseItemRowLike,
    PurchaseItemPricingContext,
    SupplierLimitInfo,
    StageStrategyShim,
} from './order';

// Pricing
export {
    formatActiveStepHint,
    parsePriceTiers,
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    computeUnitPriceRubFromItem,
    computeAmountDueNewModel,
    resolveOrgFeePercent,
    resolveCurrencyRate,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromUnitRub,
    type PriceTier,
    type OrderQuantityOptions,
    type CurrencyRate,
} from './pricing';

export { buildOrderQtyOptions, getOrderQuantityStep, getSupplementStep, getActiveStep } from './pricing';

// Pack discount
export {
    countFullSupplierPacks,
    splitQtyIntoPackages,
    getPackDiscountPricingInfo,
    formatPackDiscountBanner,
    formatPackDiscountHint,
    type PackDiscountPricingInfo,
} from './pack-discount';

// Supplement formatting (stub implementations)
export {
    formatSupplementPhotoRemainderBadge,
    formatSupplementCardPreviewHint,
    formatSupplementOrderHint,
} from './supplement-formatting';

// Payment proof MIME types
export { PROOF_MIME_TYPES, PROOF_MIME_BY_EXT } from './proof-mime';

// Errors
export {
    AppError,
    NotFoundError,
    ValidationError,
    BusinessRuleError,
    InsufficientStockError,
    PurchaseNotActiveError,
    InvalidPaymentTransitionError,
    ForbiddenError,
} from './errors';

// Settings
export {
    SETTINGS_SCHEMA,
    isSettingKey,
    getSettingDef,
    parseSettingValue,
    serializeSettingValue,
    serializeDefault,
    type SettingKey,
    type SettingValue,
    type SettingDef,
    type SettingType,
} from './settings';

export { positiveOrNull, isPositive, formatQtyLabel } from './utils';

// Units
export {
    UNITS,
    getUnitByCode,
    getUnitByShortName,
    resolveUnit,
    isWeightUnit,
    isPieceUnit,
    normalizeUnitCode,
    normalizeUnitShortName,
    type UnitKind,
    type UnitDef,
} from './units';

// Order strategies — checks per fulfillment stage
export {
    canAdjustOrder,
    canAddNewItem,
    canCancelOrder,
    canDecreaseOrder,
    canIncreaseFromRemainder,
    isOrderingClosedStage,
    isSupplementPhase,
} from './order-strategies';

// Purchase fulfillment state machine
export {
    FULFILLMENT_TRANSITIONS,
    canAddItemsAtStage,
    canTransitionFulfillment,
    isFreezePoint,
    isPaymentPlusFreezePoint,
    isUnfreezePoint,
} from './purchase-fulfillment';

// Notifications
export {
    COALESCABLE_NOTIFICATION_TYPES,
    COALESCE_DELIVERY_DELAY_MS,
    COALESCE_WINDOW_MS,
    NOTIFICATION_TYPES,
    NOTIFIABLE_FULFILLMENT_STAGES,
    renderNotificationTitle,
    renderNotificationBody,
    renderNotificationTelegramBody,
    renderNotificationUrl,
    getNotificationVisual,
    getNotificationFields,
    type CoalesceCandidate,
    type NotificationType,
    type NotificationPayloads,
    type NotificationPayload,
    type NotifyInput,
    type NotificationIconKind,
    type NotificationTone,
    type NotificationVisual,
    type NotificationField,
} from './notifications';
