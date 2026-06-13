import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── I. Несколько юзеров ────────────────────────────────────────────

describe('I. Несколько юзеров', () => {
    it('user1 взял 30 → user2 может взять ещё 20', () => {
        const book = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 30);
        const pool = book.poolFor(2);
        expect(pool.canAddMore).toBe(20);
    });

    it('user2 взял 20 → user1 canAddMore=0', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 30);
        const book2 = applyAdjust(book1, 2, 20);
        const pool = book2.poolFor(1);
        expect(pool.canAddMore).toBe(0);
    });
});
