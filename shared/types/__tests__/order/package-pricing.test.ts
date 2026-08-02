import { describe, expect, it } from 'vitest';

import { computeAmountDueWithPackages, computePackagePrice, OrderBook } from '../../src/order';
import { makeItem } from './__helpers__';

// Регресс: упаковки учитываются в amountDue через effectiveQty × unitPriceRub.
// computePackagePrice = unitPriceRub × packAmount (новая модель цен).

describe('computePackagePrice — unitPriceRub × packAmount', () => {
    it('pricePerPackCurrency=120, packAmount=12, rate=1, orgFee=0 → unitPriceRub=10, package=120', () => {
        const item = makeItem('COLLECTION', { packAmount: 12, pricePerPackCurrency: 120 });
        expect(computePackagePrice(item)).toBe(120);
    });

    it('цену можно задать через курс валюты', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 10,
            currencyRates: [{ currencyId: 1, rateToRub: 12 }],
        });
        // packPriceRub = 10 × 12 = 120; unitPriceRub = 120 / 12 = 10; package = 10 × 12 = 120
        expect(computePackagePrice(item)).toBe(120);
    });

    it('orgFeePercent увеличивает цену упаковки', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 10,
            pricePerPackCurrency: 100,
            orgFeePercentOverride: 10,
        });
        // packPriceRub = 100; withOrgFee = 110; unitPriceRub = 11; package = 11 × 10 = 110
        expect(computePackagePrice(item)).toBe(110);
    });
});

describe('computeAmountDueWithPackages — упаковки не бесплатные', () => {
    it('qty=0 + 1 упаковка → цена упаковки, не 0', () => {
        const item = makeItem('COLLECTION', { packAmount: 12, pricePerPackCurrency: 120 });
        // unitPriceRub = 10; effectiveQty = 0 + 1×12 = 12; amountDue = 12 × 10 = 120
        expect(computeAmountDueWithPackages(0, 1, item)).toBe(120);
    });

    it('россыпь + упаковка суммируются', () => {
        const item = makeItem('COLLECTION', { packAmount: 12, pricePerPackCurrency: 120 });
        // 5 ед. россыпи (5×10=50) + 1 упаковка (120) = 170
        expect(computeAmountDueWithPackages(5, 1, item)).toBe(170);
    });
});

describe('OrderBook.adjustPackages — amountDue через новую модель (end-to-end)', () => {
    it('добавление упаковки к пустому заказу даёт ненулевой amountDue', () => {
        const item = makeItem('COLLECTION', { packAmount: 12, pricePerPackCurrency: 120 });
        const result = OrderBook.create(item).adjustPackages(1, 1);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const line = result.book.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(1);
        expect(line?.amountDue).toBe(120);
    });
});
