import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── F. Пул (на COLLECTION его нет) ──────────────────────────────────

describe('F. Пул на COLLECTION отсутствует', () => {
    it('remainder === null', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        expect(book.remainder).toBeNull();
    });

    it('poolFor → pool=null, maxAllowed=Infinity', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const pool = book.poolFor(1);

        expect(pool.pool).toBeNull();
        expect(pool.maxAllowed).toBe(Number.POSITIVE_INFINITY);
        expect(pool.canAddMore).toBe(Number.POSITIVE_INFINITY);
    });
});
