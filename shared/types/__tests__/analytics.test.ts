import {
    bucketIndex,
    bucketize,
    computeDelta,
    resolvePeriod,
    startOfMskDay,
    summarizePurchaseDebts,
} from '../src/analytics';

describe('startOfMskDay', () => {
    it('returns Moscow midnight in UTC', () => {
        // 18 ноября, 23:30 МСК = 20:30 UTC
        expect(startOfMskDay(new Date('2026-11-18T20:30:00Z')).toISOString()).toBe('2026-11-17T21:00:00.000Z');
    });

    it('moves to the next day after Moscow midnight', () => {
        // 19 ноября, 00:30 МСК = 18 ноября, 21:30 UTC
        expect(startOfMskDay(new Date('2026-11-18T21:30:00Z')).toISOString()).toBe('2026-11-18T21:00:00.000Z');
    });
});

describe('resolvePeriod', () => {
    const now = new Date('2026-11-18T09:00:00Z'); // 12:00 МСК

    it('ends at the end of today and spans 30 daily buckets', () => {
        const p = resolvePeriod('30d', now);
        expect(p.to.toISOString()).toBe('2026-11-18T21:00:00.000Z');
        expect(p.from.toISOString()).toBe('2026-10-19T21:00:00.000Z');
        expect(p.bucketCount).toBe(30);
        expect(p.prevTo).toEqual(p.from);
        expect(p.to.getTime() - p.from.getTime()).toBe(p.from.getTime() - p.prevFrom.getTime());
    });

    it('uses weekly buckets for 90 days and a year', () => {
        expect(resolvePeriod('90d', now).bucketCount).toBe(13);
        expect(resolvePeriod('365d', now).bucketCount).toBe(52);
        expect(resolvePeriod('365d', now).bucketMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
});

describe('bucketize', () => {
    const p = resolvePeriod('7d', new Date('2026-11-18T09:00:00Z'));

    it('puts values into day buckets and ignores out-of-range rows', () => {
        const rows = [
            { at: new Date('2026-11-12T00:00:00Z'), v: 100 }, // 12.11 03:00 МСК — первый день
            { at: new Date('2026-11-18T20:59:00Z'), v: 50 }, // 18.11 23:59 МСК — последний
            { at: new Date('2026-11-18T21:00:00Z'), v: 999 }, // уже завтра
            { at: new Date('2026-11-11T20:59:00Z'), v: 999 }, // до периода
        ];
        const series = bucketize(
            p,
            rows,
            (r) => r.at,
            (r) => r.v,
        );
        expect(series).toEqual([100, 0, 0, 0, 0, 0, 50]);
    });

    it('counts rows by default', () => {
        expect(bucketIndex(p, new Date('2026-11-15T12:00:00Z'))).toBe(3);
        expect(bucketize(p, [new Date('2026-11-15T12:00:00Z')], (d) => d)).toEqual([0, 0, 0, 1, 0, 0, 0]);
    });
});

describe('computeDelta', () => {
    it('returns percent change', () => {
        expect(computeDelta(120, 100)).toEqual({ kind: 'change', percent: 20 });
        expect(computeDelta(50, 200)).toEqual({ kind: 'change', percent: -75 });
    });

    it('marks growth from zero as new and zero-to-zero as none', () => {
        expect(computeDelta(10, 0)).toEqual({ kind: 'new' });
        expect(computeDelta(0, 0)).toEqual({ kind: 'none' });
    });
});

describe('summarizePurchaseDebts', () => {
    it('sums per-participant debt with the same rules as the participant sees', () => {
        const result = summarizePurchaseDebts(
            [
                { purchaseId: 1, userId: 10, due: 1000 },
                { purchaseId: 1, userId: 11, due: 500 },
                { purchaseId: 1, userId: 12, due: 300 },
            ],
            [
                { purchaseId: 1, userId: 10, status: 'CONFIRMED', total: 1000 },
                { purchaseId: 1, userId: 11, status: 'CONFIRMED', total: 200 },
                { purchaseId: 1, userId: 11, status: 'PENDING', total: 300 },
                { purchaseId: 1, userId: 12, status: 'AWAITING', total: 300 },
                { purchaseId: 1, userId: 12, status: 'REJECTED', total: 300 },
            ],
        );
        expect(result.get(1)).toEqual({
            purchaseId: 1,
            participants: 3,
            due: 1800,
            confirmed: 1200,
            pending: 300,
            awaiting: 300,
            debt: 600,
            debtors: 2,
        });
    });

    it('does not count overpayment as negative debt and ignores payments without orders', () => {
        const result = summarizePurchaseDebts(
            [{ purchaseId: 2, userId: 1, due: 100 }],
            [
                { purchaseId: 2, userId: 1, status: 'CONFIRMED', total: 150 },
                { purchaseId: 2, userId: 99, status: 'CONFIRMED', total: 500 },
            ],
        );
        expect(result.get(2)).toMatchObject({ participants: 1, due: 100, confirmed: 100, debt: 0, debtors: 0 });
    });
});
