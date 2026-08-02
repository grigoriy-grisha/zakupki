import { describe, expect, it } from 'vitest';

import {
    computeAmountDueNewModel,
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    computeUnitPriceRubFromItem,
    resolveCurrencyRate,
    resolveOrgFeePercent,
} from '../src/pricing/currency-pricing';

describe('computePackPriceRub (кол. 4)', () => {
    it('умножает цену на курс', () => {
        expect(computePackPriceRub(100, 92.5)).toBe(9250);
        expect(computePackPriceRub(10, 1)).toBe(10);
    });

    it('возвращает null если цена или курс не заданы', () => {
        expect(computePackPriceRub(null, 92.5)).toBeNull();
        expect(computePackPriceRub(100, null)).toBeNull();
        expect(computePackPriceRub(null, null)).toBeNull();
    });

    it('возвращает null для нечисловых значений', () => {
        expect(computePackPriceRub(NaN, 92.5)).toBeNull();
        expect(computePackPriceRub(100, Infinity)).toBeNull();
    });

    it('округляет до копеек', () => {
        expect(computePackPriceRub(33.33, 3)).toBe(99.99);
        expect(computePackPriceRub(10.005, 1)).toBe(10.01); // 10.005 → 10.01 (банковское не нужно)
    });
});

describe('resolveOrgFeePercent', () => {
    it('override приоритетнее дефолта', () => {
        expect(resolveOrgFeePercent(15, 10)).toBe(15);
        expect(resolveOrgFeePercent(0, 10)).toBe(0);
    });

    it('использует дефолт при null override', () => {
        expect(resolveOrgFeePercent(null, 10)).toBe(10);
    });

    it('использует дефолт при некорректном override', () => {
        expect(resolveOrgFeePercent(NaN, 10)).toBe(10);
    });
});

describe('computePackPriceWithOrgFee (кол. 5)', () => {
    it('умножает на (1 + оргсбор/100)', () => {
        expect(computePackPriceWithOrgFee(100, 10)).toBe(110);
        expect(computePackPriceWithOrgFee(1000, 0)).toBe(1000);
        expect(computePackPriceWithOrgFee(50, 100)).toBe(100);
    });

    it('возвращает null при отсутствии базовой цены', () => {
        expect(computePackPriceWithOrgFee(null, 10)).toBeNull();
    });
});

describe('computeUnitPriceRub (кол. 6)', () => {
    it('делит цену упаковки на вес', () => {
        expect(computeUnitPriceRub(100, 50)).toBe(2);
        expect(computeUnitPriceRub(110, 10)).toBe(11);
    });

    it('возвращает null при отсутствии цены или веса', () => {
        expect(computeUnitPriceRub(null, 50)).toBeNull();
        expect(computeUnitPriceRub(100, null)).toBeNull();
    });

    it('возвращает null при весе ≤ 0', () => {
        expect(computeUnitPriceRub(100, 0)).toBeNull();
        expect(computeUnitPriceRub(100, -5)).toBeNull();
    });
});

describe('resolveCurrencyRate', () => {
    const rates = [
        { currencyId: 1, rateToRub: 1 },
        { currencyId: 2, rateToRub: 92.5 },
        { currencyId: 3, rateToRub: 12.8 },
    ];

    it('находит курс по id валюты', () => {
        expect(resolveCurrencyRate(rates, 2)).toBe(92.5);
        expect(resolveCurrencyRate(rates, 1)).toBe(1);
    });

    it('возвращает null если валюта не задана', () => {
        expect(resolveCurrencyRate(rates, null)).toBeNull();
    });

    it('возвращает null если курс для валюты отсутствует', () => {
        expect(resolveCurrencyRate(rates, 999)).toBeNull();
    });
});

describe('computeUnitPriceRubFromItem (полная цепочка)', () => {
    it('считает кол.6 одним заходом', () => {
        // 100 у.е. × 92.5 = 9250 ₽ (кол.4); +10% орг = 10175 ₽ (кол.5); /50 гр = 203.5 ₽/гр (кол.6)
        expect(
            computeUnitPriceRubFromItem({
                pricePerPackCurrency: 100,
                rateToRub: 92.5,
                orgFeePercent: 10,
                packSize: 50,
            }),
        ).toBe(203.5);
    });

    it('возвращает null если часть цепочки отсутствует', () => {
        expect(
            computeUnitPriceRubFromItem({
                pricePerPackCurrency: null,
                rateToRub: 92.5,
                orgFeePercent: 10,
                packSize: 50,
            }),
        ).toBeNull();
        expect(
            computeUnitPriceRubFromItem({
                pricePerPackCurrency: 100,
                rateToRub: 92.5,
                orgFeePercent: 10,
                packSize: null,
            }),
        ).toBeNull();
    });
});

describe('computeAmountDueNewModel (сумма заказа)', () => {
    it('effectiveQty × unitPriceRub', () => {
        // 5 гр + 1 пачка(50гр) = 55 гр; 55 × 2 = 110 ₽
        expect(
            computeAmountDueNewModel({
                quantity: 5,
                packageCount: 1,
                packSize: 50,
                unitPriceRub: 2,
            }),
        ).toBe(110);
    });

    it('без пачек — просто quantity × цена', () => {
        expect(
            computeAmountDueNewModel({
                quantity: 10,
                packageCount: 0,
                packSize: null,
                unitPriceRub: 3.5,
            }),
        ).toBe(35);
    });

    it('возвращает null если unitPriceRub неизвестен', () => {
        expect(
            computeAmountDueNewModel({
                quantity: 10,
                packageCount: 0,
                packSize: 50,
                unitPriceRub: null,
            }),
        ).toBeNull();
    });
});
