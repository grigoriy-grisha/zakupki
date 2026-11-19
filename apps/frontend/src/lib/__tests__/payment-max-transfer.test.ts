import { computePromoDiscount, roundMoney } from '@zakupki/types';
import { describe, expect, it } from 'vitest';

import { computeMaxTransfer, computeSubmittedAmount, exceedsMaxTransfer } from '../payment-utils';

const OKS = { type: 'PERCENT' as const, value: 4, minAmount: null };

describe('computeMaxTransfer', () => {
    it('считает максимум в копейках без float-хвоста (случай со скриншота)', () => {
        expect(3001.83 - 120.07).not.toBe(2881.76);
        expect(computeMaxTransfer(3001.83, OKS)).toBe(2881.76);
    });

    it('ровно максимальная сумма не считается превышением — кнопка активна', () => {
        const max = computeMaxTransfer(3001.83, OKS);
        expect(exceedsMaxTransfer(2881.76, max)).toBe(false);
        expect(exceedsMaxTransfer(2881.77, max)).toBe(true);
    });

    it('без промокода максимум — весь остаток', () => {
        expect(computeMaxTransfer(1234.56, null)).toBe(1234.56);
    });

    it('промокод с минимальной суммой выше остатка не уменьшает максимум', () => {
        expect(computeMaxTransfer(500, { ...OKS, minAmount: 1000 })).toBe(500);
    });

    it('фиксированная скидка', () => {
        expect(computeMaxTransfer(1000.1, { type: 'FIXED' as const, value: 200.2, minAmount: null })).toBe(799.9);
    });

    it('перебор остатков в копейках: максимум всегда проходит проверку', () => {
        for (let kop = 100; kop < 500000; kop += 37) {
            const available = kop / 100;
            const max = computeMaxTransfer(available, OKS);
            expect(exceedsMaxTransfer(max, max)).toBe(false);
            expect(Math.round(max * 100) / 100).toBe(max);
        }
    });
});

describe('computeSubmittedAmount', () => {
    it('«Оплатить всё» со скриншота закрывает ровно остаток', () => {
        expect(computeSubmittedAmount(2881.76, 3001.83, OKS)).toBe(3001.83);
    });

    it('обратный пересчёт процента не превышает остаток (100.12 → не 100.13)', () => {
        expect(computeSubmittedAmount(96.12, 100.12, OKS)).toBe(100.12);
    });

    it('«Оплатить всё» всегда проходит серверную проверку и даёт перевод = максимум', () => {
        for (let kop = 10000; kop < 500000; kop += 7) {
            const available = kop / 100;
            const max = computeMaxTransfer(available, OKS);
            const gross = computeSubmittedAmount(max, available, OKS);
            expect(roundMoney(gross)).toBeLessThanOrEqual(available);
            expect(roundMoney(gross - computePromoDiscount('PERCENT', 4, gross))).toBe(max);
        }
    });

    it('без промокода сумма не меняется', () => {
        expect(computeSubmittedAmount(500, 1000, null)).toBe(500);
    });

    it('минимальную сумму промокода сверяет с суммой заказа, а не с остатком', () => {
        // Заказ 5000, уже оплачено 4000, промокод от 3000: на остаток 1000 скидка действует.
        expect(computeMaxTransfer(1000, { ...OKS, minAmount: 3000 }, 5000)).toBeLessThan(1000);
        expect(computeMaxTransfer(1000, { ...OKS, minAmount: 6000 }, 5000)).toBe(1000);
    });
});
