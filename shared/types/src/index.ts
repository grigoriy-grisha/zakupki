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
export const HANDOFF_STATUSES = ['ASSEMBLED', 'READY_TO_SHIP', 'SENT', 'RECEIVED', 'STORED'] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_STATUS_LABELS: Record<HandoffStatus, string> = {
    ASSEMBLED: 'Собран',
    READY_TO_SHIP: 'К отправке',
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
export type {
    AdjustResult,
    AggregatedOrder,
    LineUpdate,
    MultiUpdate,
    OrderDisplayContext,
    OrderEffect,
    OrderError,
    OrderErrorCode,
    OrderLineProps,
    OrderLineRowLike,
    OrderLineStatus,
    OrderLineVO,
    PoolAggregation,
    PoolInfo,
    PurchaseItem,
    PurchaseItemPricingContext,
    PurchaseItemRowLike,
    StageConfig,
    StageStrategyShim,
    SupplierLimitInfo,
    TargetLineType,
    ZeroQuantityAction,
} from './order';
export {
    aggregateForPool,
    CollectionStrategy,
    computeAmountDue,
    computeAmountDueWithPackages,
    computePackagePrice,
    computePoolInfo,
    computeRawPool,
    computeRawSupplierLimit,
    computeSupplierLimitInfo,
    computeUnitPriceRubNewModel,
    effectiveQty,
    getStageConfig,
    getStageStrategy,
    getUnitShortName,
    makeStrategy,
    mapToPurchaseItem,
    mergeLines,
    OrderBook,
    OrderLine,
    PaymentPlusStrategy,
    ReorderStrategy,
    // ООП StageStrategy (v3)
    StageStrategy,
    sumEffectiveQty,
    toOrderLinesVO,
    toOrderLineVO,
    totalOrderedQuantity,
    userEffectiveQty,
    validateSupplementPool,
    validateSupplierLimit,
} from './order';

// Pricing
export {
    computeAmountDueNewModel,
    computeOrderLinePriceBreakdown,
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    computeUnitPriceRubFromItem,
    type CurrencyRate,
    formatActiveStepHint,
    type OrderLinePriceBreakdown,
    type OrderQuantityOptions,
    parsePriceTiers,
    type PriceTier,
    resolveCurrencyRate,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from './pricing';
export { buildOrderQtyOptions, getActiveStep,getOrderQuantityStep, getSupplementStep } from './pricing';

// Pack discount
export {
    countFullSupplierPacks,
    formatPackDiscountBanner,
    formatPackDiscountHint,
    getPackDiscountPricingInfo,
    type PackDiscountPricingInfo,
    splitQtyIntoPackages,
} from './pack-discount';

// Supplement formatting (stub implementations)
export {
    formatSupplementCardPreviewHint,
    formatSupplementOrderHint,
    formatSupplementPhotoRemainderBadge,
} from './supplement-formatting';

// Payment proof MIME types
export { PROOF_MIME_BY_EXT,PROOF_MIME_TYPES } from './proof-mime';

// Errors
export {
    AppError,
    BusinessRuleError,
    ForbiddenError,
    InsufficientStockError,
    InvalidPaymentTransitionError,
    NotFoundError,
    PurchaseNotActiveError,
    ValidationError,
} from './errors';

// Settings
export {
    getSettingDef,
    isSettingKey,
    parseSettingValue,
    serializeDefault,
    serializeSettingValue,
    type SettingDef,
    type SettingKey,
    SETTINGS_SCHEMA,
    type SettingType,
    type SettingValue,
} from './settings';
export { formatQtyLabel,isPositive, positiveOrNull } from './utils';

// Units
export {
    applyPieceUnitInvariants,
    getUnitByCode,
    getUnitByShortName,
    isPieceUnit,
    isWeightUnit,
    normalizeUnitCode,
    normalizeUnitShortName,
    resolveUnit,
    unitPluralForm,
    type UnitDef,
    type UnitKind,
    UNITS,
} from './units';

// Order strategies — checks per fulfillment stage
export {
    canAddNewItem,
    canAdjustOrder,
    canCancelOrder,
    canDecreaseOrder,
    canIncreaseFromRemainder,
    isOrderingClosedStage,
    isSupplementPhase,
} from './order-strategies';

// Purchase fulfillment state machine
export {
    canAddItemsAtStage,
    canTransitionFulfillment,
    FULFILLMENT_TRANSITIONS,
    isFreezePoint,
    isPaymentPlusFreezePoint,
    isUnfreezePoint,
} from './purchase-fulfillment';

// Purchase status state machine
export {
    canTransitionPurchaseStatus,
    PURCHASE_STATUS_TRANSITIONS,
} from './purchase-status';

// Notifications
export {
    COALESCABLE_NOTIFICATION_TYPES,
    COALESCE_DELIVERY_DELAY_MS,
    COALESCE_WINDOW_MS,
    type CoalesceCandidate,
    getNotificationFields,
    getNotificationVisual,
    NOTIFIABLE_FULFILLMENT_STAGES,
    NOTIFICATION_TYPES,
    type NotificationField,
    type NotificationIconKind,
    type NotificationPayload,
    type NotificationPayloads,
    type NotificationTone,
    type NotificationType,
    type NotificationVisual,
    type NotifyInput,
    renderNotificationBody,
    renderNotificationTelegramBody,
    renderNotificationTitle,
    renderNotificationUrl,
} from './notifications';
