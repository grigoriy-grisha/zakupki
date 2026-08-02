import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── G. COLLECTION-строка из предыдущего этапа ──────────────────────

describe('G. COLLECTION-строка из предыдущего этапа', () => {
    it('adjust(+20) при наличии COLLECTION-строки → две строки, supplement=20', () => {
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);

        expect(book2.lines).toHaveLength(2);
        expect(book2.baseLineFor(1)?.quantity).toBe(80);
        expect(book2.supplementLineFor(1)?.quantity).toBe(20);
        expect(book2.supplementLineFor(1)?.createdOnStage).toBe('PAYMENT');
    });

    it('totalFor агрегирует base + supplement = 100', () => {
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);

        const total = book2.totalFor(1);
        expect(total.quantity).toBe(100);
    });
});
