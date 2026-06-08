import type { OrderQuantityOptions } from './pricing';
import { formatQtyLabel } from './utils';

/**
 * Badge для фото на доборе — показывает остаток в кружке.
 */
export function formatSupplementPhotoRemainderBadge(
    _remainder: number,
    _maxRemainder: number,
): string {
    // Упрощённо — возвращаем пустую строку, badge рисуется в UI по другому
    return '';
}

/**
 * Подсказка для карточки товара на доборе.
 */
export function formatSupplementCardPreviewHint(
    _supplementPacks: number,
    _supplementRemainder: number,
    _packSize: number | null,
    _maxRemainder: number,
    _options: OrderQuantityOptions,
    _fulfillmentStatus?: string | null,
): string {
    return '';
}

/**
 * Подсказка в модалке заказа на доборе.
 */
export function formatSupplementOrderHint(
    state: {
        supplementPacks: number;
        supplementRemainder: number;
        packSize: number | null;
        maxRemainder: number;
    },
    _options: OrderQuantityOptions,
    _fulfillmentStatus?: string | null,
): string {
    if (state.maxRemainder <= 0) {
        return 'Весь остаток выбран';
    }
    return `Доступно: ${formatQtyLabel(state.maxRemainder)}`;
}