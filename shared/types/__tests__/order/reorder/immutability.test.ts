import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── O. Иммутабельность ─────────────────────────────────────────────

describe('O. Иммутабельность', () => {
    it('после adjust исходный book не изменился', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adjust(1, 30);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines).not.toBe(book.lines);
    });

    it('после adjustPackages исходный book не изменился', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adjustPackages(1, 1);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
    });
});
