import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── J. CANCELLED-строка ────────────────────────────────────────────

describe('J. CANCELLED-строка', () => {
    it('CANCELLED-строка не попадает в activeLines', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    status: 'CANCELLED',
                    createdOnStage: 'COLLECTION',
                }),
            ),
        ]);

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
        expect(book.baseLineFor(1)).toBeNull();
        // пул считается по активным → remainder = 50
        expect(book.remainder).toBe(50);
    });
});
