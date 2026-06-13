import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── M. CANCELLED-строка ────────────────────────────────────────────

describe('M. CANCELLED-строка', () => {
    it('CANCELLED-строка не попадает в activeLines и не учитывается в пуле', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    status: 'CANCELLED',
                }),
            ),
        ]);

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
        expect(book.baseLineFor(1)).toBeNull();
        // пул считается по активным, а их нет → remainder = 50
        expect(book.remainder).toBe(50);
    });
});
