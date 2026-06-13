import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── K. displayContextFor на REORDER ────────────────────────────────

describe('K. displayContextFor на REORDER', () => {
    it('isSupplement=true на REORDER (этап добора из остатков)', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const ctx = book.displayContextFor(1);
        expect(ctx.isSupplement).toBe(true);
    });

    it('canAdd=true при наличии остатка', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(true);
    });

    it('canAdd=false когда пул исчерпан', () => {
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 50);
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(false);
    });

    it('canDecrease=true когда qty>0', () => {
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 10);
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(10);
        expect(ctx.canDecrease).toBe(true);
    });

    it('canDecrease=true даже если qty=baseQuantity (на REORDER не лимитируем baseQuantity)', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const ctx = book.displayContextFor(1);
        // base 80 + supplement 0 = 80, qty === baseQuantity
        expect(ctx.currentQuantity).toBe(80);
        expect(ctx.canDecrease).toBe(true);
    });

    it('minAllowed=0 на REORDER (не как на PAYMENT+)', () => {
        const book = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const ctx = book.displayContextFor(1);
        expect(ctx.minAllowed).toBe(0);
    });

    it('showPackageButtons=true если supplierPackageAmount задан', () => {
        const book = OrderBook.create(makeItem('REORDER', { supplierPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(true);
    });

    it('maxAllowed=pool+currentQuantity', () => {
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 30);
        const ctx = book.displayContextFor(1);
        // pool=20, currentQuantity=30, maxAllowed=50
        expect(ctx.maxAllowed).toBe(50);
    });
});
