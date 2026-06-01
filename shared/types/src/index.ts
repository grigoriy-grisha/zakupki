// Shared types for the zakupki project

export type PurchaseStatus = 'DRAFT' | 'ACTIVE' | 'SUPPLEMENT' | 'CLOSED' | 'ARRIVED' | 'DONE';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активная',
    SUPPLEMENT: 'Добор',
    CLOSED: 'Закрыта',
    ARRIVED: 'Пришла',
    DONE: 'Завершена',
};

export type PurchaseFulfillmentStatus =
    | 'COLLECTION'
    | 'REORDER'
    | 'PAYMENT'
    | 'SUPPLIER_ASSEMBLY'
    | 'PREPARING_SHIPMENT_RF'
    | 'IN_TRANSIT_RF'
    | 'IN_TRANSIT_TO_ORGANIZER'
    | 'PACKAGING'
    | 'READY_FOR_PICKUP';

export const PURCHASE_FULFILLMENT_STATUSES: PurchaseFulfillmentStatus[] = [
    'COLLECTION',
    'REORDER',
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
];

export const PURCHASE_FULFILLMENT_LABELS: Record<PurchaseFulfillmentStatus, string> = {
    COLLECTION: 'Сбор заказов',
    REORDER: 'Доборы',
    PAYMENT: 'Оплата заказов',
    SUPPLIER_ASSEMBLY: 'На комплектации у поставщика',
    PREPARING_SHIPMENT_RF: 'Подготовка к отправке в РФ',
    IN_TRANSIT_RF: 'Едет в РФ',
    IN_TRANSIT_TO_ORGANIZER: 'Едет до организатора',
    PACKAGING: 'Фасовка',
    READY_FOR_PICKUP: 'Заказы готовы к выдаче (отправке)',
};

/** Оплата доступна на этапе PAYMENT и всех последующих. */
export function isPurchasePaymentOpen(status: PurchaseFulfillmentStatus | null | undefined): boolean {
    const current = status ?? 'COLLECTION';
    const idx = PURCHASE_FULFILLMENT_STATUSES.indexOf(current);
    const paymentIdx = PURCHASE_FULFILLMENT_STATUSES.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

export {
    calculateOrderAmount,
    formatMinPackageOrderHint,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getOrderQuantityValidationError,
    isValidOrderQuantity,
    parsePriceTiers,
    snapOrderQuantity,
    type CalculateOrderAmountOptions,
    type OrderQuantityOptions,
    type PriceTier,
} from './pricing';

export {
    countFullSupplierPacks,
    formatPackDiscountBanner,
    formatPackDiscountHint,
    getPackDiscountPricingInfo,
    getSupplierPackSize,
    isGramSupplierPackProduct,
    type PackDiscountPricingInfo,
    type SupplierPackProductFields,
} from './pack-discount-pricing';

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

export {
    APP_SETTING_KEYS,
    DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT,
    computeDiscountedPackPrice,
} from './app-settings';
