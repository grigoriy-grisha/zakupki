/**
 * Форматирование подсказок о скидках на пачки поставщика
 */
import type { PackDiscountPricingInfo } from './types';
import { formatQtyLabel } from '../utils';

/**
 * Краткая подсказка: "−X% при заказе целой пачки"
 */
export function formatPackDiscountHint(info: PackDiscountPricingInfo): string {
    return `−${info.discountPercent}% при заказе целой пачки ${info.packSize} гр`;
}

/**
 * Баннер для карточки товара с инфой о скидке на пачку
 */
export function formatPackDiscountBanner(info: PackDiscountPricingInfo): string {
    return `Пачка ${info.packSize} гр = ${info.discountedPackPrice.toLocaleString('ru-RU')} ₽ (−${info.discountPercent}%)`;
}
