import { describe, expect, it } from 'vitest';

import { computeRawPool } from '../../../src/order';

function agg(overrides: Partial<Parameters<typeof computeRawPool>[0]['aggregation']> = {}) {
    return {
        totalBaseQuantity: 0,
        supplementClaimed: 0,
        totalOrderedQuantity: 0,
        totalOrderedWithPackages: 0,
        ...overrides,
    };
}

describe('computeRawPool: композиция с orderedQty', () => {
    it('шт без orderedQty → null (безлимит, регресс)', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 1,
                aggregation: agg({ totalOrderedQuantity: 30, totalOrderedWithPackages: 30 }),
                unitCode: 'piece',
            }),
        ).toBeNull();
    });

    it('шт с orderedQty → ordered − собранное', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 1,
                aggregation: agg({ totalOrderedQuantity: 28, totalOrderedWithPackages: 28 }),
                unitCode: 'piece',
                orderedQty: 30,
            }),
        ).toBe(2);
    });

    it('туба идёт по пути шт', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 1,
                aggregation: agg({ totalOrderedQuantity: 9, totalOrderedWithPackages: 9 }),
                unitCode: 'tube',
                orderedQty: 12,
            }),
        ).toBe(3);
    });

    it('гр без orderedQty → пачки, как раньше (регресс)', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 100,
                aggregation: agg({ totalBaseQuantity: 250, totalOrderedQuantity: 250, totalOrderedWithPackages: 250 }),
                unitCode: 'gram',
            }),
        ).toBe(50);
    });

    it('гр с orderedQty → min(пачки, ordered)', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 100,
                aggregation: agg({ totalBaseQuantity: 250, totalOrderedQuantity: 250, totalOrderedWithPackages: 250 }),
                unitCode: 'gram',
                orderedQty: 270,
            }),
        ).toBe(20);
    });

    it('targetRemainder без orderedQty → target − claimed (регресс)', () => {
        expect(
            computeRawPool({
                targetRemainder: 50,
                packSize: 100,
                aggregation: agg({ supplementClaimed: 5, totalOrderedQuantity: 105 }),
                unitCode: 'gram',
            }),
        ).toBe(45);
    });

    it('targetRemainder + orderedQty → min', () => {
        expect(
            computeRawPool({
                targetRemainder: 50,
                packSize: 1,
                aggregation: agg({ totalOrderedQuantity: 20, totalOrderedWithPackages: 20 }),
                unitCode: 'piece',
                orderedQty: 22,
            }),
        ).toBe(2);
    });

    it('собрано больше заказанного → пул 0, не отрицательный', () => {
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 1,
                aggregation: agg({ totalOrderedQuantity: 33, totalOrderedWithPackages: 33 }),
                unitCode: 'piece',
                orderedQty: 30,
            }),
        ).toBe(0);
    });
});
