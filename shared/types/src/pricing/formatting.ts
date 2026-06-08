import type { OrderQuantityOptions } from './types';
import { formatQtyLabel, positiveOrNull } from '../utils';

/**
 * Только «Мин. фасовка: …» — фасовка из карточки товара (minPackageAmount).
 * Не использовать минимум добора (SUPPLEMENT_MIN_ORDER_QTY) и не getMinOrderQuantity.
 */
export function formatMinPackageHint(options: OrderQuantityOptions): string | null {
    const step = positiveOrNull(options.minPackageAmount);
    if (step == null) return null;
    const unit = options.minPackageUnit ?? options.unitShort ?? 'ед.';
    return `Мин. фасовка: ${formatQtyLabel(step)} ${unit}`;
}

/**
 * Подсказка о минимальной фасовке и кратности заказа
 */
export function formatMinPackageOrderHint(options: OrderQuantityOptions): string | null {
    const hint = formatMinPackageHint(options);
    if (!hint) return null;
    const step = positiveOrNull(options.minPackageAmount)!;
    const unit = options.minPackageUnit ?? options.unitShort ?? 'ед.';
    return `${hint} · заказ кратно ${formatQtyLabel(step)} ${unit}`;
}
