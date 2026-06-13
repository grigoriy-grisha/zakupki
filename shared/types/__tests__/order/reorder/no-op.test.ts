import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── F. Убавка без строк — no-op ────────────────────────────────────

describe('F. Убавка без строк', () => {
    it('adjust(-5) на пустой книге → ok, без изменений', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });

    it('adjust(0) → ok, без изменений', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adjust(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });
});
