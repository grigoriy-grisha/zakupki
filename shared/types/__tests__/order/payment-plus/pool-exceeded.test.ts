import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── F. Превышение пула ─────────────────────────────────────────────

describe('F. Превышение пула', () => {
    it('adjust(+60) при остатке=50 → ошибка pool_exceeded', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }));
        const result = book.adjust(1, 60);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(50);
    });

    it('user1 взял 30, user2 берёт 30 → pool_exceeded canAddMore=20', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 30);
        const result = book1.adjust(2, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(20);
    });
});
