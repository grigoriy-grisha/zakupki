import { describe, expect, it } from 'vitest';

import { calculateOrderAmount, parsePriceTiers } from '../src/pricing';

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

describe('calculateOrderAmount', () => {
    it('returns 0 for non-positive quantity', () => {
        expect(calculateOrderAmount(0, { pricePerUnit: 100 })).toBe(0);
        expect(calculateOrderAmount(-5, { pricePerUnit: 100 })).toBe(0);
        expect(calculateOrderAmount(NaN, { pricePerUnit: 100 })).toBe(0);
    });

    it('calculates by pricePerUnit when no tiers', () => {
        expect(calculateOrderAmount(10, { pricePerUnit: 50 })).toBe(500);
        expect(calculateOrderAmount(0.5, { pricePerUnit: 200 })).toBe(100);
    });

    it('uses priceOverride when set', () => {
        expect(calculateOrderAmount(10, { pricePerUnit: 100, priceOverride: 50 })).toBe(500);
        expect(calculateOrderAmount(10, { pricePerUnit: 100, priceOverride: 0 })).toBe(1000);
        expect(calculateOrderAmount(10, { pricePerUnit: 100, priceOverride: null })).toBe(1000);
    });

    it('matches exact tier', () => {
        const tiers = [
            { amount: 10, price: 340 },
            { amount: 50, price: 1500 },
        ];
        expect(calculateOrderAmount(10, { pricePerUnit: 50, priceTiers: tiers })).toBe(340);
        expect(calculateOrderAmount(50, { pricePerUnit: 50, priceTiers: tiers })).toBe(1500);
    });

    it('uses largest packages first, remainder at smallest tier rate', () => {
        const tiers = [
            { amount: 10, price: 340 },  // 34 per unit
            { amount: 50, price: 1500 }, // 30 per unit
        ];
        // 55 = 1x50 (1500) + 5x remaining at 34/unit = 1500 + 170 = 1670
        expect(calculateOrderAmount(55, { pricePerUnit: 50, priceTiers: tiers })).toBe(1670);
    });

    it('handles decimal quantities', () => {
        expect(calculateOrderAmount(1.5, { pricePerUnit: 100 })).toBe(150);
    });

    it('rounds to 2 decimal places', () => {
        // 33.333... * 3 = 99.999...
        expect(calculateOrderAmount(3, { pricePerUnit: 33.333 })).toBe(100);
    });
});
