import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── H. Превышение пула ─────────────────────────────────────────────

describe('H. Превышение пула', () => {
    it('adjust(+30) при остатке=20 → ошибка pool_exceeded', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(20);
    });

    it('после ошибки книга не изменилась', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book1.adjust(1, 30);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        // на ошибке book возвращается тот же (immutable)
        expect(book1.baseLineFor(1)?.quantity).toBe(80);
        expect(book1.supplementLineFor(1)).toBeNull();
    });

    it('adjust(+60) при остатке=50 на пустой книге → ошибка', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }));
        const result = book.adjust(1, 60);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
    });
});
