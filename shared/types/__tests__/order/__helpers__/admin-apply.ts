import type { OrderBook } from '../../../src/order';

/**
 * Admin-обёртки: бросают исключение при `!result.ok`, иначе возвращают
 * новую книгу. Эти методы работают в обход stage-rules (canAddNew, canDecrease,
 * poolApplies), поэтому для них отдельные хелперы.
 */
export function applyAdminDelete(book: OrderBook, userId: number): OrderBook {
    const result = book.adminDelete(userId);
    if (!result.ok) throw new Error(`adminDelete неожиданно упал: ${result.error.message}`);
    return result.book;
}

export function applyAdminDecrease(book: OrderBook, userId: number, amount: number): OrderBook {
    const result = book.adminDecrease(userId, amount);
    if (!result.ok) throw new Error(`adminDecrease неожиданно упал: ${result.error.message}`);
    return result.book;
}

export function applyAdminAdd(book: OrderBook, userId: number, amount: number): OrderBook {
    const result = book.adminAdd(userId, amount);
    if (!result.ok) throw new Error(`adminAdd неожиданно упал: ${result.error.message}`);
    return result.book;
}

export function applyAdminSetQuantity(book: OrderBook, userId: number, qty: number): OrderBook {
    const result = book.adminSetQuantity(userId, qty);
    if (!result.ok) throw new Error(`adminSetQuantity неожиданно упал: ${result.error.message}`);
    return result.book;
}
