import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── N. displayContextFor: supplement дробный ───────────────────────

describe('N. displayContextFor: supplementStep', () => {
    it('supplementStep=5 → activeStep=5', () => {
        const book = OrderBook.create(makeItem('REORDER', { supplementStep: 5, minPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(5);
    });

    it('без supplementStep → activeStep=multiplicity', () => {
        const book = OrderBook.create(makeItem('REORDER', { multiplicity: 2, minPackageAmount: null }));
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(2);
    });
});
