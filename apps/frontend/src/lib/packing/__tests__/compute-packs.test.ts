import { describe, expect, it } from 'vitest';

import { computePacks } from '../compute-packs';

describe('computePacks', () => {
    it('2 × 160 г WEIGHT → 50×6, 10×2', () => {
        // 160 = 50+50+50+10, два юзера → 50×6, 10×2
        const result = computePacks({
            isWeight: true,
            orders: [
                { userId: 1, quantity: 160 },
                { userId: 2, quantity: 160 },
            ],
        });
        expect(result).toEqual([
            { size: 50, needed: 6 },
            { size: 10, needed: 2 },
        ]);
    });

    it('90 г + 60 г WEIGHT → 50, 50, 40, 10', () => {
        const result = computePacks({
            isWeight: true,
            orders: [
                { userId: 1, quantity: 90 },
                { userId: 2, quantity: 60 },
            ],
        });
        expect(result).toEqual([
            { size: 50, needed: 2 },
            { size: 40, needed: 1 },
            { size: 10, needed: 1 },
        ]);
    });

    it('50 г WEIGHT — одна пачка 50, не две по 25', () => {
        const result = computePacks({
            isWeight: true,
            orders: [{ userId: 1, quantity: 50 }],
        });
        expect(result).toEqual([{ size: 50, needed: 1 }]);
    });

    it('PIECE: 5 + 3 + 1 → пачки 5, 3, 1 (без дробления)', () => {
        const result = computePacks({
            isWeight: false,
            orders: [
                { userId: 1, quantity: 5 },
                { userId: 2, quantity: 3 },
                { userId: 3, quantity: 1 },
            ],
        });
        expect(result).toEqual([
            { size: 5, needed: 1 },
            { size: 3, needed: 1 },
            { size: 1, needed: 1 },
        ]);
    });

    it('PIECE: одинаковые объёмы агрегируются', () => {
        const result = computePacks({
            isWeight: false,
            orders: [
                { userId: 1, quantity: 2 },
                { userId: 2, quantity: 2 },
                { userId: 3, quantity: 2 },
            ],
        });
        expect(result).toEqual([{ size: 2, needed: 3 }]);
    });

    it('quantity <= 0 и NaN игнорируются', () => {
        const result = computePacks({
            isWeight: true,
            orders: [
                { userId: 1, quantity: 0 },
                { userId: 2, quantity: -5 },
                { userId: 3, quantity: Number.NaN },
                { userId: 4, quantity: 25 },
            ],
        });
        expect(result).toEqual([{ size: 25, needed: 1 }]);
    });

    it('пустой orders → []', () => {
        const result = computePacks({ isWeight: true, orders: [] });
        expect(result).toEqual([]);
    });

    it('130 г WEIGHT → 50, 50, 30 (жадный)', () => {
        const result = computePacks({
            isWeight: true,
            orders: [{ userId: 1, quantity: 130 }],
        });
        expect(result).toEqual([
            { size: 50, needed: 2 },
            { size: 30, needed: 1 },
        ]);
    });
});
