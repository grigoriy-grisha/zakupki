import { describe, expect, it } from 'vitest';

import {
    buildHistogram,
    classifyParticipantPayment,
    computePackFill,
    cumulative,
    median,
    summarizeMoney,
} from '../src/analytics';

describe('buildHistogram', () => {
    it('раскладывает чеки по корзинам с подписями в тысячах', () => {
        const bins = buildHistogram([500, 999, 1000, 3500, 25000]);
        expect(bins.map((b) => b.label)).toEqual(['до 1', '1–2', '2–4', '4–6', '6–10', '10–20', '20+']);
        expect(bins.map((b) => b.count)).toEqual([2, 1, 1, 0, 0, 0, 1]);
    });
});

describe('median', () => {
    it('нечётное и чётное число значений', () => {
        expect(median([5, 1, 3])).toBe(3);
        expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(median([])).toBe(0);
    });
});

describe('classifyParticipantPayment', () => {
    const totals = (confirmedPaid: number, pendingPaid = 0, awaitingPaid = 0) => ({
        confirmedPaid,
        pendingPaid,
        awaitingPaid,
    });
    it('различает все состояния', () => {
        expect(classifyParticipantPayment(1000, totals(1000))).toBe('paid');
        expect(classifyParticipantPayment(1000, totals(999.995))).toBe('paid');
        expect(classifyParticipantPayment(1000, totals(200, 800))).toBe('pending');
        expect(classifyParticipantPayment(1000, totals(0, 0, 1000))).toBe('awaiting');
        expect(classifyParticipantPayment(1000, totals(300))).toBe('partial');
        expect(classifyParticipantPayment(1000, totals(0))).toBe('unpaid');
    });
});

describe('computePackFill', () => {
    it('считает целые упаковки и недобор', () => {
        expect(computePackFill(1350, 500)).toEqual({ packs: 2.7, fullPacks: 2, fraction: 0.7, need: 150 });
        expect(computePackFill(1000, 500)).toEqual({ packs: 2, fullPacks: 2, fraction: 0, need: 0 });
    });
    it('без размера упаковки или заказов — null', () => {
        expect(computePackFill(100, 0)).toBeNull();
        expect(computePackFill(0, 500)).toBeNull();
    });
});

describe('summarizeMoney', () => {
    it('сумма частей равна сумме заказов, промо вычитается из оргсбора', () => {
        const money = summarizeMoney(
            [
                { amountDue: 1150, breakdown: { baseRub: 1000, deliveryRub: 50, orgFeeRub: 100 } },
                { amountDue: 300, breakdown: null },
            ],
            40,
        );
        expect(money).toEqual({ orders: 1450, supplier: 1000, delivery: 50, orgFee: 60, promo: 40, unpriced: 300 });
        expect(money.supplier + money.delivery + money.orgFee + money.promo + money.unpriced).toBe(money.orders);
    });
});

describe('cumulative', () => {
    it('нарастающий итог', () => {
        expect(cumulative([1, 0, 2.5, 1])).toEqual([1, 1, 3.5, 4.5]);
    });
});
