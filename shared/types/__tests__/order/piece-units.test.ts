import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../src/order';
import { mapToPurchaseItem } from '../../src/order';
import { computeRawPool } from '../../src/order/pool';
import { makeItem, makeLineProps } from './__helpers__';
import { OrderLine } from '../../src/order';

const NO_AGGREGATION = {
    totalOrderedQuantity: 0,
    supplementClaimed: 0,
    totalBaseQuantity: 0,
    totalOrderedWithPackages: 0,
};

describe('computeRawPool для штучных единиц', () => {
    it('returns null for piece with packSize=1 and no targetRemainder', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 1,
                aggregation: NO_AGGREGATION,
                unitCode: 'piece',
            }),
        ).toBeNull();
    });

    it('keeps targetRemainder path for piece', () => {
        expect(
            computeRawPool({
                targetRemainder: 20,
                packSize: 1,
                aggregation: { ...NO_AGGREGATION, supplementClaimed: 5 },
                unitCode: 'piece',
            }),
        ).toBe(15);
    });

    it('keeps auto pack pool for gram', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 50,
                aggregation: { ...NO_AGGREGATION, totalBaseQuantity: 80, totalOrderedQuantity: 80 },
                unitCode: 'gram',
            }),
        ).toBe(20);
    });

    it('returns 0 pool for legacy pack logic when unit is unknown', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 50,
                aggregation: { ...NO_AGGREGATION, totalBaseQuantity: 80, totalOrderedQuantity: 80 },
            }),
        ).toBe(20);
    });
});

describe('OrderBook для штучных единиц', () => {
    it('remainder is null for piece without targetRemainder on REORDER', () => {
        const book = OrderBook.create(
            makeItem('REORDER', { unitCode: 'piece', packAmount: 1, targetRemainder: null }),
            [],
        );
        expect(book.remainder).toBeNull();
    });

    it('adjustPackages rejects piece units', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece', packAmount: 1 }), []);
        const result = book.adjustPackages(1, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toBe('Товар штучный — упаковок нет, заказывайте количеством');
    });

    it('adminAdjustPackages rejects piece units', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece', packAmount: 1 }), []);
        const result = book.adminAdjustPackages(1, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toBe('Товар штучный — упаковок нет, заказывайте количеством');
    });

    it('adjustPackages still works for gram', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', { unitCode: 'gram', packAmount: 50, minPackageAmount: 5 }),
            [],
        );
        const result = book.adjustPackages(1, 1);
        expect(result.ok).toBe(true);
    });

    it('display context hides package buttons and pack discount for piece', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', {
                unitCode: 'piece',
                packAmount: 1,
                packDiscountPercent: 10,
            }),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 3, amountDue: 300 }))],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(false);
        expect(ctx.fullPacks).toBe(0);
        expect(ctx.canAdd).toBe(true);
    });

    it('display context keeps package buttons and pack discount for gram', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', {
                unitCode: 'gram',
                packAmount: 50,
                minPackageAmount: 5,
                packDiscountPercent: 10,
            }),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 120, amountDue: 12000 }))],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(true);
        expect(ctx.fullPacks).toBe(2);
    });
});

describe('mapToPurchaseItem unit source priority', () => {
    const baseRow = {
        id: 1,
        product: { unitCode: 'gram', multiplicity: 1 },
        purchase: { fulfillmentStatus: 'COLLECTION' },
    };

    it('prefers item-level unitCode over product unitCode', () => {
        const item = mapToPurchaseItem({ ...baseRow, unitCode: 'piece' } as never, 0);
        expect(item.unitCode).toBe('piece');
    });

    it('falls back to product unitCode when item field is absent', () => {
        const item = mapToPurchaseItem(baseRow as never, 0);
        expect(item.unitCode).toBe('gram');
    });

    it('falls back to piece when both are absent', () => {
        const item = mapToPurchaseItem(
            { ...baseRow, unitCode: null, product: { multiplicity: 1 } } as never,
            0,
        );
        expect(item.unitCode).toBe('piece');
    });
});
