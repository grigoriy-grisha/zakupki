/**
 * Информация о скидке на пачку (новая модель цен).
 */
export type PackDiscountPricingInfo = {
    /** Размер пачки (гр/шт). */
    packSize: number;
    /** Цена пачки в ₽ (без скидки, с учётом оргсбора). */
    packPrice: number;
    /** Цена пачки в ₽ со скидкой. */
    discountedPackPrice: number;
    /** Процент скидки (0..100). */
    discountPercent: number;
};
