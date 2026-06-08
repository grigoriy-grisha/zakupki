import type { OrderQuantityOptions } from './types';
import { isPositive, positiveOrNull } from '../utils';

/**
 * Округление вверх до шага
 */
export function roundUpToStep(value: number, step: number): number {
    if (step <= 0) return value;
    return Math.ceil((value - 1e-9) / step) * step;
}

/**
 * Проверка, кратно ли количество шагу
 */
export function isMultipleOf(quantity: number, step: number): boolean {
    const remainder = quantity % step;
    return remainder < 1e-6 || Math.abs(remainder - step) < 1e-6;
}

/**
 * Шаг заказа: мин. фасовка товара, иначе кратность единицы измерения.
 */
export function getOrderQuantityStep(options: OrderQuantityOptions): number {
    return positiveOrNull(options.minPackageAmount) ?? positiveOrNull(options.multiplicity) ?? 1;
}

/**
 * Минимальное количество заказа: мин. фасовка товара, иначе minQty позиции, иначе шаг.
 */
export function getMinOrderQuantity(options: OrderQuantityOptions): number {
    const step = getOrderQuantityStep(options);
    const base = positiveOrNull(options.minPackageAmount) ?? positiveOrNull(options.purchaseItemMinQty) ?? step;
    return roundUpToStep(base, step);
}

/**
 * Приводит количество к допустимому: не ниже мин., не выше max, кратно шагу.
 */
export function snapOrderQuantity(
    quantity: number,
    options: OrderQuantityOptions,
    bounds?: { max?: number | null },
): number {
    const step = getOrderQuantityStep(options);
    const min = getMinOrderQuantity(options);
    let qty = Math.max(min, quantity);

    if (bounds?.max != null) {
        qty = Math.min(qty, bounds.max);
        if (!isMultipleOf(qty, step)) {
            qty = Math.floor((qty + 1e-9) / step) * step;
        }
        return qty < min ? 0 : qty;
    }

    if (!isMultipleOf(qty, step)) {
        qty = roundUpToStep(qty, step);
    }
    return qty;
}
