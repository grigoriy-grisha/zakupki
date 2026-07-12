import { describe, expect, it } from 'vitest';

import { computeAmountDueWithPackages, computePackagePrice, OrderBook } from '../../src/order';
import { makeItem } from './__helpers__';

// Регресс: упаковки были бесплатными, когда ценник задан через priceOverride
// (pricePerUnit=0), т.к. computePackagePrice игнорировал priceOverride.

describe('computePackagePrice — учитывает priceOverride', () => {
    it('priceOverride бьёт pricePerUnit (типовый сценарий админки)', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 0,
            priceOverride: 10,
            supplierPackageAmount: 12,
            supplierPackagePrice: null,
        });
        expect(computePackagePrice(item)).toBe(120);
    });

    it('без priceOverride — fallback на pricePerUnit', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 10,
            priceOverride: null,
            supplierPackageAmount: 12,
        });
        expect(computePackagePrice(item)).toBe(120);
    });

    it('явная supplierPackagePrice приоритетнее priceOverride/pricePerUnit', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 0,
            priceOverride: 10,
            supplierPackageAmount: 12,
            supplierPackagePrice: 50,
        });
        expect(computePackagePrice(item)).toBe(50);
    });
});

describe('computeAmountDueWithPackages — упаковки не бесплатные при priceOverride', () => {
    it('qty=0 + 1 упаковка → цена упаковки, не 0', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 0,
            priceOverride: 10,
            supplierPackageAmount: 12,
        });
        // До фикса computePackagePrice игнорил priceOverride → amountDue был 0.
        expect(computeAmountDueWithPackages(0, 1, item)).toBe(120);
    });

    it('россыпь + упаковка суммируются', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 0,
            priceOverride: 10,
            supplierPackageAmount: 12,
        });
        // 5 ед. россыпи (5×10=50) + 1 упаковка (120) = 170
        expect(computeAmountDueWithPackages(5, 1, item)).toBe(170);
    });
});

describe('OrderBook.adjustPackages — amountDue через priceOverride (end-to-end)', () => {
    it('добавление упаковки к пустому заказу даёт ненулевой amountDue', () => {
        const item = makeItem('COLLECTION', {
            pricePerUnit: 0,
            priceOverride: 10,
            supplierPackageAmount: 12,
        });
        const result = OrderBook.create(item).adjustPackages(1, 1);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const line = result.book.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(1);
        expect(line?.amountDue).toBe(120); // до фикса было 0
    });
});
