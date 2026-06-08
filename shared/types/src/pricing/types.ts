/**
 * Ценовая ступень
 */
export type PriceTier = {
    amount: number;
    unit?: string;
    price: number;
};

/**
 * Опции для расчёта суммы заказа
 */
export type CalculateOrderAmountOptions = {
    priceTiers?: unknown;
    pricePerUnit: number;
    priceOverride?: number | null;
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
    packDiscountPercent?: number | null;
};

/**
 * Опции количества заказа для валидации и расчётов
 */
export type OrderQuantityOptions = {
    multiplicity?: number | null;
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    purchaseItemMinQty?: number | null;
    unitShort?: string | null;
};
