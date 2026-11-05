import { describe, expect, it } from 'vitest';

import { isStepMultiple, nearestStepMultiples } from '../order-collection.service';

describe('isStepMultiple', () => {
    it('accepts exact multiples', () => {
        expect(isStepMultiple(10, 10)).toBe(true);
        expect(isStepMultiple(40, 10)).toBe(true);
        expect(isStepMultiple(60, 30)).toBe(true);
    });

    it('rejects non-multiples', () => {
        expect(isStepMultiple(25, 10)).toBe(false);
        expect(isStepMultiple(40, 30)).toBe(false);
        expect(isStepMultiple(7, 5)).toBe(false);
    });

    it('tolerates floating point for fractional steps', () => {
        expect(isStepMultiple(7.5, 2.5)).toBe(true);
        expect(isStepMultiple(0.3, 0.1)).toBe(true);
        expect(isStepMultiple(0.35, 0.1)).toBe(false);
    });

    it('any integer passes with step 1', () => {
        for (const n of [1, 2, 3, 17, 999]) expect(isStepMultiple(n, 1)).toBe(true);
    });

    it('treats a non-positive step as no restriction', () => {
        expect(isStepMultiple(13, 0)).toBe(true);
        expect(isStepMultiple(13, -5)).toBe(true);
    });
});

describe('nearestStepMultiples', () => {
    it('returns the multiples around the amount', () => {
        expect(nearestStepMultiples(25, 10)).toEqual([20, 30]);
        expect(nearestStepMultiples(40, 30)).toEqual([30, 60]);
        expect(nearestStepMultiples(8, 2.5)).toEqual([7.5, 10]);
    });

    it('drops zero when the amount is below one step', () => {
        expect(nearestStepMultiples(3, 10)).toEqual([10]);
    });

    it('does not produce float noise', () => {
        expect(nearestStepMultiples(0.35, 0.1)).toEqual([0.3, 0.4]);
    });
});
