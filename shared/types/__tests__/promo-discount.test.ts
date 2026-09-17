import { describe, expect, it } from 'vitest';

import { computePromoDiscount } from '../src';

describe('computePromoDiscount', () => {
    it('PERCENT — rounds to 2 decimals', () => {
        expect(computePromoDiscount('PERCENT', 4, 24758.4)).toBe(990.34);
        expect(computePromoDiscount('PERCENT', 10, 999.99)).toBe(100);
    });

    it('FIXED — returns the fixed value', () => {
        expect(computePromoDiscount('FIXED', 500, 2000)).toBe(500);
    });

    it('caps the discount so at least 1 ₽ stays payable', () => {
        expect(computePromoDiscount('FIXED', 500, 300)).toBe(299);
        expect(computePromoDiscount('PERCENT', 99, 50)).toBe(49);
    });

    it('returns 0 for amounts below 1 ₽', () => {
        expect(computePromoDiscount('PERCENT', 4, 0.5)).toBe(0);
        expect(computePromoDiscount('FIXED', 100, 0)).toBe(0);
    });
});
