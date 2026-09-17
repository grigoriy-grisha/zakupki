import { computePaymentTotals } from '../src/payment-summary';

describe('computePaymentTotals', () => {
    it('computes remaining from confirmed payments only', () => {
        const totals = computePaymentTotals(1000, [
            { status: 'CONFIRMED', total: 400 },
            { status: 'REJECTED', total: 100 },
        ]);

        expect(totals.confirmedPaid).toBe(400);
        expect(totals.remaining).toBe(600);
        expect(totals.available).toBe(600);
        expect(totals.hasPending).toBe(false);
    });

    it('available subtracts pending on top of remaining', () => {
        const totals = computePaymentTotals(510.9, [{ status: 'PENDING', total: 371.94 }]);

        expect(totals.remaining).toBe(510.9);
        expect(totals.available).toBe(138.96);
        expect(totals.hasPending).toBe(true);
    });

    it('floors available at zero when pending covers more than remaining', () => {
        const totals = computePaymentTotals(100, [
            { status: 'CONFIRMED', total: 30 },
            { status: 'PENDING', total: 90 },
        ]);

        expect(totals.remaining).toBe(70);
        expect(totals.available).toBe(0);
    });

    it('rounds to kopecks', () => {
        const totals = computePaymentTotals(100.1, [{ status: 'CONFIRMED', total: 33.333 }]);

        expect(totals.remaining).toBe(66.77);
    });

    it('handles no payments', () => {
        const totals = computePaymentTotals(250, []);

        expect(totals).toEqual({
            confirmedPaid: 0,
            pendingPaid: 0,
            hasPending: false,
            remaining: 250,
            available: 250,
        });
    });
});
