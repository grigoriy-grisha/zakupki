import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── D. Убавка добора (supplement) ──────────────────────────────────

describe('D. Убавка добора', () => {
    it('adjust(-10) на supplement-строке → qty=10, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20); // supplement: 20
        const book3 = applyAdjust(book2, 1, -10); // supplement: 10

        expect(book3.supplementLineFor(1)?.quantity).toBe(10);
        expect(book3.baseLineFor(1)?.quantity).toBe(80);
        expect(book3.lines).toHaveLength(2);
    });

    it('adjust(-20) на supplement-строке → supplement удаляется, COLLECTION остаётся', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);
        const result = book2.adjust(1, -20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.supplementLineFor(1)).toBeNull();
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.lines).toHaveLength(1);
    });
});

// ── G. Смешанная убавка: сначала добор, потом база ─────────────────

describe('G. Смешанная убавка', () => {
    it('-10 → supplement=10, -20 → supplement удалена, -30 → base=50', () => {
        let book = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        book = applyAdjust(book, 1, 20); // supplement: 20

        book = applyAdjust(book, 1, -10);
        expect(book.supplementLineFor(1)?.quantity).toBe(10);
        expect(book.baseLineFor(1)?.quantity).toBe(80);

        book = applyAdjust(book, 1, -20);
        expect(book.supplementLineFor(1)).toBeNull();
        expect(book.baseLineFor(1)?.quantity).toBe(80);

        book = applyAdjust(book, 1, -30);
        expect(book.baseLineFor(1)?.quantity).toBe(50);
        expect(book.lines).toHaveLength(1);
    });
});
