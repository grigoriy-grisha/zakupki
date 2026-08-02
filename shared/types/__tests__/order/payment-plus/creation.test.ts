import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── A. Создание книги на PAYMENT ───────────────────────────────────

describe('A. Создание книги на PAYMENT', () => {
    it('пустая книга → нет строк', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        expect(book.lines).toHaveLength(0);
        expect(book.activeLines).toHaveLength(0);
    });

    it('remainder виден сразу (targetRemainder=50)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }));
        expect(book.remainder).toBe(50);
    });

    it('poolFor для пустой книги → pool=50, canAddMore=50', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const pool = book.poolFor(1);
        expect(pool.pool).toBe(50);
        expect(pool.canAddMore).toBe(50);
    });
});
