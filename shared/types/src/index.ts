// Shared types for the zakupki project

export type PurchaseStatus = 'DRAFT' | 'ACTIVE' | 'SUPPLEMENT' | 'CLOSED' | 'ARRIVED' | 'DONE';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    DRAFT: 'Chernovik',
    ACTIVE: 'Aktivnaya',
    SUPPLEMENT: 'Dobor',
    CLOSED: 'Zakryta',
    ARRIVED: 'Prishla',
    DONE: 'Zavershena',
};

/** Zakupka zavershena organizatorom — zakazy ukhodyat v «proshlye». */
export function isPurchaseCompleted(status: PurchaseStatus | string | null | undefined): boolean {
    return status === 'DONE';
}

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
    COLLECTION: 'Sbor zakazov',
    REORDER: 'Dobory',
    PAYMENT: 'Oplata zakazov',
    SUPPLIER_ASSEMBLY: 'Na komplektatsii u postavshchika',
    PREPARING_SHIPMENT_RF: 'Podgotovka k otpravke v RF',
    IN_TRANSIT_RF: 'Edet v RF',
    IN_TRANSIT_TO_ORGANIZER: 'Edet do organizatora',
    PACKAGING: 'Fasovka',
    READY_FOR_PICKUP: 'Zakazy gotovy k vydache (otpravke)',
};

/** Oplata dostupna na etape PAYMENT i vsekh posleduyushchikh. */
export function isPurchasePaymentOpen(status: PurchaseFulfillmentStatus | null | undefined): boolean {
    const current = (status ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const idx = PURCHASE_FULFILLMENT_STATUSES.indexOf(current);
    const paymentIdx = PURCHASE_FULFILLMENT_STATUSES.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

// Supplement pool calculation
export { getSupplementPool } from './supplement';

// Pricing
export {
    calculateOrderAmount,
    formatMinPackageHint,
    formatMinPackageOrderHint,
    parsePriceTiers,
    type CalculateOrderAmountOptions,
    type PriceTier,
    type OrderQuantityOptions,
} from './pricing';

export {
    buildOrderQtyOptions,
    getOrderQuantityStep,
    getMinOrderQuantity,
    snapOrderQuantity,
    getOrderQuantityValidationError,
    isValidOrderQuantity,
} from './pricing';

// Pack discount
export {
    countFullSupplierPacks,
    getPackDiscountPricingInfo,
    getSupplierPackSize,
    isGramSupplierPackProduct,
    formatPackDiscountBanner,
    formatPackDiscountHint,
    type PackDiscountPricingInfo,
    type SupplierPackProductFields,
} from './pack-discount';

// Supplement formatting (stub implementations)
export {
    formatSupplementPhotoRemainderBadge,
    formatSupplementCardPreviewHint,
    formatSupplementOrderHint,
} from './supplement-formatting';

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
    computeDiscountedPackPrice,
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

// Order strategies (simplified)
export { canAdjustOrder, canCancelOrder } from './order-strategies';

// Purchase fulfillment state machine
export {
    FULFILLMENT_TRANSITIONS,
    canTransitionFulfillment,
    isFreezePoint,
    isUnfreezePoint,
} from './purchase-fulfillment';