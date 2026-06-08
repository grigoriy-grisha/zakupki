import type { OrderQuantityOptions } from './types';
import { getOrderQuantityStep, getMinOrderQuantity, isMultipleOf } from './quantity-rules';
import { formatQtyLabel, isPositive, positiveOrNull } from '../utils';

/**
 * Валидация количества заказа
 * Возвращает null если OK, иначе сообщение об ошибке
 */
export function getOrderQuantityValidationError(quantity: number, options: OrderQuantityOptions): string | null {
    if (!isPositive(quantity)) return 'Укажите положительное количество';

    const step = getOrderQuantityStep(options);
    const min = getMinOrderQuantity(options);
    const unit =
        positiveOrNull(options.minPackageAmount) != null && options.minPackageUnit
            ? options.minPackageUnit
            : (options.unitShort ?? 'ед.');
    const stepLabel = formatQtyLabel(step);
    const minLabel = formatQtyLabel(min);

    if (quantity + 1e-9 < min) {
        if (positiveOrNull(options.minPackageAmount) != null) {
            return `Мин. фасовка: ${stepLabel} ${unit}`;
        }
        return `Минимальный заказ: ${minLabel} ${unit}`;
    }

    if (!isMultipleOf(quantity, step)) {
        if (positiveOrNull(options.minPackageAmount) != null) {
            return `Можно заказать только кратно ${stepLabel} ${unit}: ${stepLabel}, ${formatQtyLabel(step * 2)}, ${formatQtyLabel(step * 3)}…`;
        }
        return `Количество должно быть кратно ${stepLabel} ${unit}`;
    }

    return null;
}

/**
 * Проверка, валидно ли количество заказа
 */
export function isValidOrderQuantity(quantity: number, options: OrderQuantityOptions): boolean {
    return getOrderQuantityValidationError(quantity, options) === null;
}
