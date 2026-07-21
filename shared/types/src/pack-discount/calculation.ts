import type { PackDiscountPricingInfo } from './types';

/**
 * Информация о скидке на пачку по новой модели цен.
 *
 * packPriceRub — цена упаковки в ₽ (с учётом курса и оргсбора).
 * discountPercent — глобальная скидка за целую пачку (%).
 *
 * Возвращает null, если packSize или packPriceRub не заданы, либо скидка невалидна.
 */
export function getPackDiscountPricingInfo(
    packSize: number | null,
    packPriceRub: number | null,
    discountPercent: number,
): PackDiscountPricingInfo | null {
    if (packSize == null || packPriceRub == null) return null;
    if (packSize <= 0 || packPriceRub <= 0) return null;
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;

    return {
        packSize,
        packPrice: packPriceRub,
        discountedPackPrice: computeDiscountedPackPrice(packPriceRub, discountPercent),
        discountPercent,
    };
}

/**
 * Считает количество целых пачек в заказе по количеству и размеру пачки.
 */
export function countFullSupplierPacks(quantity: number, packSize: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0 || packSize <= 0) return 0;
    return Math.floor((quantity + 1e-9) / packSize);
}

/**
 * Цена упаковки со скидкой: packPrice × (1 − discount/100).
 */
function computeDiscountedPackPrice(packPrice: number, discountPercent: number): number {
    return Math.round(packPrice * (1 - discountPercent / 100) * 100) / 100;
}
