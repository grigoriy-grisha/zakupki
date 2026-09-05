import { describe, expect, it } from 'vitest';

import { computeAmountDueWithPackages, computePackagePrice, mapToPurchaseItem, OrderBook } from '../../src/order';
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

describe('deliveryPercent — аддитивная наценка и override товара', () => {
    it('orgFee=10 + delivery=5 → ×1.15 (1000 + 100 + 50)', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 10,
            pricePerPackCurrency: 1000,
            orgFeePercentOverride: 10,
            deliveryPercent: 5,
        });
        // unit = 1000 × 1.15 / 10 = 115; package = 115 × 10 = 1150
        expect(computePackagePrice(item)).toBe(1150);
    });

    it('mapToPurchaseItem: override товара приоритетнее процента закупки', () => {
        const mapped = mapToPurchaseItem(
            { id: 1, product: {}, purchase: {}, deliveryPercentOverride: 7 },
            0,
            { deliveryPercent: 5 },
        );
        expect(mapped.deliveryPercentOverride).toBe(7);
        expect(mapped.deliveryPercent).toBe(7);
    });

    it('mapToPurchaseItem: без override — процент закупки', () => {
        const mapped = mapToPurchaseItem({ id: 1, product: {}, purchase: {} }, 0, {
            deliveryPercent: 5,
        });
        expect(mapped.deliveryPercentOverride).toBeNull();
        expect(mapped.deliveryPercent).toBe(5);
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

describe('pack discount — скидка за целые пачки', () => {
    it('computePackagePrice со скидкой: 120 × 0.97 = 116.4', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        expect(computePackagePrice(item)).toBe(116.4);
    });

    it('целая пачка в amountDue: 1 упаковка = цена со скидкой', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        expect(computeAmountDueWithPackages(0, 1, item)).toBe(116.4);
    });

    it('россыпь по полной цене + пачка со скидкой', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        // 5 ед. россыпи (5×10=50) + пачка со скидкой (116.4) = 166.4
        expect(computeAmountDueWithPackages(5, 1, item)).toBe(166.4);
    });

    it('россыпь, кратная пачке, тоже получает скидку', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        // 24 ед. = ровно 2 пачки: 2 × 116.4 = 232.8 (без скидки было бы 240)
        expect(computeAmountDueWithPackages(24, 0, item)).toBe(232.8);
    });

    it('пачки + хвост: 30 ед. = 2 пачки со скидкой + 6 ед. россыпи', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        // 2 × 116.4 + 6 × 10 = 292.8
        expect(computeAmountDueWithPackages(30, 0, item)).toBe(292.8);
    });

    it('копейки: пачка 100 гр × 21.95 ₽ со скидкой 3% = 2129.15', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 100,
            pricePerPackCurrency: 2195,
            packDiscountPercent: 3,
        });
        // unitPriceRub = 21.95; упаковка: 2195 × 0.97 = 2129.15
        expect(computePackagePrice(item)).toBe(2129.15);
        expect(computeAmountDueWithPackages(105, 0, item)).toBe(109.75 + 2129.15);
    });

    it('скидка не применяется к штучным товарам', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 1,
            pricePerPackCurrency: 100,
            packDiscountPercent: 3,
            unitCode: 'piece',
        });
        expect(computePackagePrice(item)).toBe(100);
        expect(computeAmountDueWithPackages(0, 1, item)).toBe(100);
    });

    it('скидка не применяется к тубам', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 1,
            pricePerPackCurrency: 376.2,
            packDiscountPercent: 3,
            unitCode: 'tube',
        });
        expect(computePackagePrice(item)).toBe(376.2);
    });

    it('d=0 — прежние ожидания без скидки (регресс)', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 0,
        });
        expect(computePackagePrice(item)).toBe(120);
        expect(computeAmountDueWithPackages(5, 1, item)).toBe(170);
    });

    it('end-to-end: OrderBook.adjustPackages пишет amountDue со скидкой', () => {
        const item = makeItem('COLLECTION', {
            packAmount: 12,
            pricePerPackCurrency: 120,
            packDiscountPercent: 3,
        });
        const result = OrderBook.create(item).adjustPackages(1, 1);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.amountDue).toBe(116.4);
    });
});
