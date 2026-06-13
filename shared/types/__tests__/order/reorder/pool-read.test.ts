import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── J. Пул: чтение ────────────────────────────────────────────────

describe('J. Пул: чтение', () => {
    it('remainder виден, если targetRemainder задан', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }));
        expect(book.remainder).toBe(50);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20, supplementClaimed=30', () => {
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 30);
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(20);
        expect(pool.canAddMore).toBe(20);
        expect(pool.supplementClaimed).toBe(30);
        expect(pool.maxAllowed).toBe(50);
    });

    it('poolFor для пустого юзера при остатке=50 → pool=50, canAddMore=50', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }));
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(50);
        expect(pool.canAddMore).toBe(50);
        expect(pool.supplementClaimed).toBe(0);
    });
});
