import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── E. Убавка базовой COLLECTION-строки (после добора=0) ───────────

describe('E. Убавка базовой COLLECTION-строки', () => {
    it('adjust(-30) на COLLECTION-строке → qty=50, baseQuantity=80 (заморозка остаётся)', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, -30);

        const base = book2.baseLineFor(1);
        expect(base?.quantity).toBe(50);
        expect(base?.baseQuantity).toBe(80); // заморозка не меняется
    });

    it('adjust(-80) на COLLECTION-строке → строка удаляется (hard_delete)', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book1.adjust(1, -80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
    });
});
