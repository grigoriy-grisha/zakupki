/**
 * Поля товара для расчёта скидок на пачки поставщика
 */
export type SupplierPackProductFields = {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
};

/**
 * Информация о скидке на пачку
 */
export type PackDiscountPricingInfo = {
    packSize: number;
    packPrice: number;
    discountedPackPrice: number;
    discountPercent: number;
};