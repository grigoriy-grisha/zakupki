import type { OrderBook } from '../../../src/order';

/** Прокидываем adjust к следующему шагу. Если что-то пошло не так — кидаем. */
export function applyAdjust(book: OrderBook, userId: number, delta: number): OrderBook {
    const result = book.adjust(userId, delta);
    if (!result.ok) throw new Error(`adjust неожиданно упал: ${result.error.message}`);
    return result.book;
}

export function applyAdjustPackages(book: OrderBook, userId: number, delta: number): OrderBook {
    const result = book.adjustPackages(userId, delta);
    if (!result.ok) throw new Error(`adjustPackages неожиданно упал: ${result.error.message}`);
    return result.book;
}
