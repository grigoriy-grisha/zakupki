import { describe, expect, it } from 'vitest';

import {
    computeAmountDue,
    computeAmountDueWithPackages,
    computePackagePrice,
    computeUnitPriceRubFromItem,
    getOrderQuantityStep,
    parsePriceTiers,
} from '../src/pricing';

describe('parsePriceTiers', () => {
    it('returns empty for non-array input', () => {
        expect(parsePriceTiers(null)).toEqual([]);
        expect(parsePriceTiers('hello')).toEqual([]);
        expect(parsePriceTiers(42)).toEqual([]);
    });

    it('skips tiers with non-positive amount or price', () => {
        expect(parsePriceTiers([{ amount: -1, price: 100 }])).toEqual([]);
        expect(parsePriceTiers([{ amount: 10, price: 0 }])).toEqual([]);
        expect(parsePriceTiers([{ amount: 0, price: 50 }])).toEqual([]);
    });

    it('parses valid tiers', () => {
        const tiers = parsePriceTiers([
            { amount: 10, price: 340 },
            { amount: 50, price: 1500, unit: 'гр' },
        ]);
        expect(tiers).toEqual([
            { amount: 10, price: 340, unit: undefined },
            { amount: 50, price: 1500, unit: 'гр' },
        ]);
    });
});

// ── Новая модель цен: валюта × курс × оргсбор → unitPriceRub ──────────

describe('computeUnitPriceRubFromItem', () => {
    it('pricePerPackCurrency × rate / packSize = unitPriceRub', () => {
        // 100 ₽ × курс 1 / вес 1 = 100 ₽/ед
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: 100, rateToRub: 1, orgFeePercent: 0, packSize: 1 }),
        ).toBe(100);
    });

    it('валюта × курс', () => {
        // 5 $ × 80 ₽ / 100 гр = 4 ₽/гр
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: 5, rateToRub: 80, orgFeePercent: 0, packSize: 100 }),
        ).toBe(4);
    });

    it('с оргсбором 10%', () => {
        // 100 × (1 + 0.1) / 10 = 11
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: 100, rateToRub: 1, orgFeePercent: 10, packSize: 10 }),
        ).toBe(11);
    });

    it('возвращает null при отсутствии цены', () => {
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: null, rateToRub: 1, orgFeePercent: 0, packSize: 10 }),
        ).toBeNull();
    });

    it('возвращает null при packSize ≤ 0', () => {
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: 100, rateToRub: 1, orgFeePercent: 0, packSize: 0 }),
        ).toBeNull();
    });

    it('округляет до копеек', () => {
        // 33.333 × 1 / 1 = 33.33 (round to 2)
        expect(
            computeUnitPriceRubFromItem({ pricePerPackCurrency: 33.333, rateToRub: 1, orgFeePercent: 0, packSize: 1 }),
        ).toBe(33.33);
    });
});

// ── Default step by unit (gram → 5) ──────────────────────────────────

describe('getOrderQuantityStep: default by unit', () => {
    it('gram без фасовки/кратности → шаг 5', () => {
        expect(getOrderQuantityStep({ unitCode: 'gram' })).toBe(5);
    });

    it('gram с minPackageAmount → шаг из фасовки (не дефолт)', () => {
        expect(getOrderQuantityStep({ unitCode: 'gram', minPackageAmount: 10 })).toBe(10);
    });

    it('gram с multiplicity > 1 → шаг из кратности (не дефолт)', () => {
        expect(getOrderQuantityStep({ unitCode: 'gram', multiplicity: 2 })).toBe(2);
    });

    it('gram с multiplicity=1 (дефолт Product.multiplicity) → gram-дефолт 5', () => {
        // Реальный сценарий из БД: Product.multiplicity имеет @default(1).
        // multiplicity=1 не должна перекрывать gram-дефолт.
        expect(getOrderQuantityStep({ unitCode: 'gram', multiplicity: 1 })).toBe(5);
    });

    it('piece/tube без фасовки → шаг 1', () => {
        expect(getOrderQuantityStep({ unitCode: 'piece' })).toBe(1);
        expect(getOrderQuantityStep({ unitCode: 'tube' })).toBe(1);
    });

    it('без unitCode и без фасовки → шаг 1', () => {
        expect(getOrderQuantityStep({})).toBe(1);
    });

    it('minPackageAmount приоритетнее gram-дефолта', () => {
        // Дефолт gram=5, но minPackageAmount=3 → шаг 3.
        expect(getOrderQuantityStep({ unitCode: 'gram', minPackageAmount: 3 })).toBe(3);
    });
});
