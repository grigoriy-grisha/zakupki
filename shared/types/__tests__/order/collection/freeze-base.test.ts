import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeItem, makeLineProps } from '../__helpers__';

// ── I. freezeBaseQuantities ─────────────────────────────────────────

describe('I. Заморозка базы (подготовка к REORDER)', () => {
    it('freezeBaseQuantities проставляет baseQuantity=quantity и basePackageCount=packageCount', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100, supplierPackageAmount: 10 }), [
            OrderLine.create(makeLineProps({ quantity: 7, amountDue: 700, packageCount: 2 })),
        ]);
        const book2 = applyAdjust(book, 1, 0); // sanity: line exists
        const frozen = book2.freezeBaseQuantities();

        expect(frozen.baseLineFor(1)?.baseQuantity).toBe(7);
        expect(frozen.baseLineFor(1)?.quantity).toBe(7);
        expect(frozen.baseLineFor(1)?.basePackageCount).toBe(2);
        expect(frozen.baseLineFor(1)?.packageCount).toBe(2);
    });
});
