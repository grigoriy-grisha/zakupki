import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── H. displayContextFor на PAYMENT+ ───────────────────────────────

describe('H. displayContextFor на PAYMENT+', () => {
    it('isSupplement=true', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const ctx = book.displayContextFor(1);
        expect(ctx.isSupplement).toBe(true);
    });

    it('minAllowed=frozenBase (на PAYMENT+ нельзя ниже базы)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const ctx = book.displayContextFor(1);
        expect(ctx.minAllowed).toBe(80);
    });

    it('canAdd=true при наличии остатка', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(true);
    });

    it('canAdd=false когда пул исчерпан', () => {
        const book = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 50);
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(false);
    });

    it('canDecrease=true если currentQuantity > frozenBase (есть добор)', () => {
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);
        const ctx = book2.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(100);
        expect(ctx.canDecrease).toBe(true);
    });

    it('canDecrease=false если currentQuantity === frozenBase (только база)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(80);
        expect(ctx.canDecrease).toBe(false);
    });

    it('showPackageButtons=false (canAddPackages=false)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { supplierPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(false);
    });

    it('activeStep учитывает supplementStep', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { supplementStep: 5, minPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(5);
    });
});
