import { describe, expect, it } from 'vitest';

import { formatActiveStepHint } from '../../src/pricing/formatting';
import { getActiveStep, getOrderQuantityStep } from '../../src/pricing/quantity-rules';

describe('getOrderQuantityStep для штучных единиц', () => {
    it('ignores minPackageAmount for piece', () => {
        expect(
            getOrderQuantityStep({ unitCode: 'piece', minPackageAmount: 5, multiplicity: 1 }),
        ).toBe(1);
    });

    it('ignores minPackageAmount for tube', () => {
        expect(
            getOrderQuantityStep({ unitCode: 'tube', minPackageAmount: 5, multiplicity: 1 }),
        ).toBe(1);
    });

    it('honors multiplicity > 1 for piece', () => {
        expect(
            getOrderQuantityStep({ unitCode: 'piece', minPackageAmount: 5, multiplicity: 2 }),
        ).toBe(2);
    });

    it('uses minPackageAmount for gram', () => {
        expect(
            getOrderQuantityStep({ unitCode: 'gram', minPackageAmount: 5, multiplicity: 1 }),
        ).toBe(5);
    });

    it('defaults gram to 5 without minPackageAmount', () => {
        expect(getOrderQuantityStep({ unitCode: 'gram', minPackageAmount: null, multiplicity: 1 })).toBe(5);
    });

    it('defaults to 1 without unit', () => {
        expect(getOrderQuantityStep({ unitCode: null, minPackageAmount: null, multiplicity: 1 })).toBe(1);
    });
});

describe('getActiveStep для штучных единиц', () => {
    const pieceOptions = { unitCode: 'piece', minPackageAmount: 5, multiplicity: 1 };

    it('ignores supplementStep on reorder for piece', () => {
        expect(
            getActiveStep({ fulfillmentStatus: 'REORDER', options: pieceOptions, supplementStep: 10 }),
        ).toBe(1);
    });

    it('uses supplementStep on reorder for gram', () => {
        expect(
            getActiveStep({
                fulfillmentStatus: 'REORDER',
                options: { unitCode: 'gram', minPackageAmount: 5, multiplicity: 1 },
                supplementStep: 10,
            }),
        ).toBe(10);
    });
});

describe('formatActiveStepHint для штучных единиц', () => {
    it('returns null for piece even with min package set', () => {
        expect(
            formatActiveStepHint({
                fulfillmentStatus: 'COLLECTION',
                minPackageAmount: 5,
                minPackageUnit: 'шт',
                supplementStep: 10,
                unitShort: 'шт',
                unitCode: 'piece',
            }),
        ).toBeNull();
    });

    it('returns packing hint for gram', () => {
        expect(
            formatActiveStepHint({
                fulfillmentStatus: 'COLLECTION',
                minPackageAmount: 5,
                minPackageUnit: 'гр',
                supplementStep: null,
                unitShort: 'гр',
                unitCode: 'gram',
            }),
        ).toBe('Мин. фасовка: 5 гр');
    });

    it('returns supplement hint on reorder for gram', () => {
        expect(
            formatActiveStepHint({
                fulfillmentStatus: 'REORDER',
                minPackageAmount: 5,
                minPackageUnit: 'гр',
                supplementStep: 10,
                unitShort: 'гр',
                unitCode: 'gram',
            }),
        ).toBe('Шаг добора: 10 гр');
    });
});
