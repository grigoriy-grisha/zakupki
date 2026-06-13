import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeItem, makeLineProps } from '../__helpers__';

// ── G. Чтение строк ─────────────────────────────────────────────────

describe('G. Чтение строк', () => {
    it('COLLECTION-строка видна через baseLineFor и не видна через supplementLineFor', () => {
        const book = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 5);

        expect(book.baseLineFor(1)).not.toBeNull();
        expect(book.supplementLineFor(1)).toBeNull();
    });

    it('CANCELLED-строка не попадает в activeLines', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 }), [
            OrderLine.create(makeLineProps({ status: 'CANCELLED', quantity: 5, amountDue: 500 })),
        ]);

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
    });
});

// ── H. displayContextFor ────────────────────────────────────────────

describe('H. displayContextFor — контекст для UI', () => {
    it('packagePrice по умолчанию = pricePerUnit * supplierPackageAmount', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100, supplierPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);

        expect(ctx.packagePrice).toBe(1000);
        expect(ctx.showPackageButtons).toBe(true);
    });

    it('явный supplierPackagePrice перебивает расчёт', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', {
                pricePerUnit: 100,
                supplierPackageAmount: 10,
                supplierPackagePrice: 850,
            }),
        );
        const ctx = book.displayContextFor(1);

        expect(ctx.packagePrice).toBe(850);
    });

    it('без supplierPackageAmount → кнопки упаковок скрыты', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { supplierPackageAmount: null }));
        const ctx = book.displayContextFor(1);

        expect(ctx.showPackageButtons).toBe(false);
        expect(ctx.packagePrice).toBe(0);
    });

    it('canAdd=true, canDecrease=true (qty>0), isSoldOut=false, isSupplement=false', () => {
        const book = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 3);
        const ctx = book.displayContextFor(1);

        expect(ctx.canAdd).toBe(true);
        expect(ctx.canDecrease).toBe(true);
        expect(ctx.isSoldOut).toBe(false);
        expect(ctx.isSupplement).toBe(false);
        expect(ctx.currentQuantity).toBe(3);
    });

    it('canDecrease=false если currentQuantity=0', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const ctx = book.displayContextFor(1);

        expect(ctx.currentQuantity).toBe(0);
        expect(ctx.canDecrease).toBe(false);
    });
});
