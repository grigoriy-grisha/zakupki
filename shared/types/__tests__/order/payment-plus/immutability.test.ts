import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── K. Иммутабельность ─────────────────────────────────────────────

describe('K. Иммутабельность', () => {
    it('после adjust исходный book не изменился', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const result = book.adjust(1, 30);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines).not.toBe(book.lines);
    });
});
