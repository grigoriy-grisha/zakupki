import { describe, expect, it } from 'vitest';

import { computeOrderedStockInfo, computeRawOrderedStock, validateOrderedStock } from '../../../src/order';
import { makeItem } from '../__helpers__';

function agg(total: number, withPackages = total) {
    return {
        totalBaseQuantity: 0,
        supplementClaimed: 0,
        totalOrderedQuantity: total,
        totalOrderedWithPackages: withPackages,
    };
}

describe('OrderedStock. Математика', () => {
    it('computeRawOrderedStock: null при незаданном orderedQty', () => {
        expect(computeRawOrderedStock({ orderedQty: null, aggregation: agg(100) })).toBeNull();
    });

    it('computeRawOrderedStock: ordered − собранное, кламп в 0', () => {
        expect(computeRawOrderedStock({ orderedQty: 50, aggregation: agg(20, 20) })).toBe(30);
        expect(computeRawOrderedStock({ orderedQty: 50, aggregation: agg(60, 60) })).toBe(0);
    });

    it('computeRawOrderedStock: упаковки считаются проданным стоком', () => {
        expect(computeRawOrderedStock({ orderedQty: 100, aggregation: agg(70, 100) })).toBe(0);
        expect(computeRawOrderedStock({ orderedQty: 100, aggregation: agg(70, 90) })).toBe(10);
    });

    it('computeOrderedStockInfo: maxAllowed = stock + currentQty', () => {
        const info = computeOrderedStockInfo({ orderedQty: 50, aggregation: agg(20, 20), currentQty: 5 });
        expect(info).toEqual({ stock: 30, maxAllowed: 35, canAddMore: 30 });
    });

    it('computeOrderedStockInfo: без orderedQty — Infinity', () => {
        const info = computeOrderedStockInfo({ orderedQty: null, aggregation: agg(20, 20), currentQty: 5 });
        expect(info.maxAllowed).toBe(Number.POSITIVE_INFINITY);
    });

    it('validateOrderedStock: точно в остаток — null', () => {
        const item = makeItem('COLLECTION', { orderedQty: 50 });
        expect(validateOrderedStock(item, 50, 20, agg(20, 20))).toBeNull();
    });

    it('validateOrderedStock: сверх остатка — stock_exceeded с сообщением', () => {
        const item = makeItem('COLLECTION', { orderedQty: 50 });
        const err = validateOrderedStock(item, 51, 20, agg(20, 20));
        expect(err?.code).toBe('stock_exceeded');
        expect(err?.message).toBe('Заказано у поставщика: 50 гр. Доступно: 30 гр');
        expect(err?.canAddMore).toBe(30);
    });

    it('validateOrderedStock: единица из unitCode (шт)', () => {
        const item = makeItem('COLLECTION', { unitCode: 'piece', orderedQty: 25 });
        const err = validateOrderedStock(item, 30, 0, agg(28, 28));
        expect(err?.message).toBe('Заказано у поставщика: 25 шт. Доступно: 0 шт');
    });

    it('validateOrderedStock: единица из unitCode (туба)', () => {
        const item = makeItem('COLLECTION', { unitCode: 'tube', orderedQty: 27 });
        const err = validateOrderedStock(item, 30, 0, agg(9, 9));
        expect(err?.message).toBe('Заказано у поставщика: 27 туба. Доступно: 18 туба');
    });

    it('validateOrderedStock: отрицательный orderedQty → остаток 0', () => {
        const item = makeItem('COLLECTION', { orderedQty: -5 });
        const err = validateOrderedStock(item, 1, 0, agg(0, 0));
        expect(err?.code).toBe('stock_exceeded');
        expect(err?.canAddMore).toBe(0);
    });
});
