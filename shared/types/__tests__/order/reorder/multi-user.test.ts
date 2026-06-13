import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeItem, makeLineProps } from '../__helpers__';

// ── L. Несколько юзеров и общий пул ───────────────────────────────

describe('L. Несколько юзеров и общий пул', () => {
    it('user2 добрал 20 → pool уменьшился на 20', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, baseQuantity: 30, amountDue: 3000 })),
            OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 20, baseQuantity: 20, amountDue: 2000 })),
        ]);
        const book2 = applyAdjust(book1, 2, 20);

        // pool = 50 - 20 = 30 (canAddMore у всех = pool)
        expect(book2.remainder).toBe(30);
        expect(book2.poolFor(1).canAddMore).toBe(30);
        expect(book2.poolFor(2).canAddMore).toBe(30);
    });

    it('user1 добрал 30 → остаток стал 20 (50-30=20)', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, baseQuantity: 30, amountDue: 3000 })),
            OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 20, baseQuantity: 20, amountDue: 2000 })),
        ]);
        const book2 = applyAdjust(book1, 1, 30);

        // targetRemainder=50, user1 добрал 30 → pool = 50 - 30 = 20
        expect(book2.remainder).toBe(20);
        expect(book2.poolFor(2).canAddMore).toBe(20);
    });
});
