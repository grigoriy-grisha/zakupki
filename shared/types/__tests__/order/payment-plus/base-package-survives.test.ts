import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── M. basePackageCount переживает PAYMENT+ ──────────────────────────

describe('M. basePackageCount переживает PAYMENT+', () => {
    it('totalFor агрегирует basePackageCount из COLLECTION-строки', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 3,
                basePackageCount: 3,
            }),
        ]);
        const total = book.totalFor(1);

        expect(total.basePackageCount).toBe(3);
        expect(total.baseQuantity).toBe(80);
        expect(total.packageCount).toBe(3);
    });
});
