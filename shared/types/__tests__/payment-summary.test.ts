import { computePaymentTotals } from '../src/payment-summary';

describe('computePaymentTotals', () => {
    it('shows overpayment when confirmed payments exceed the order', () => {
        const totals = computePaymentTotals(600, [{ status: 'CONFIRMED', total: 1000.5 }]);

        expect(totals.overpaid).toBe(400.5);
        expect(totals.remaining).toBe(0);
        expect(totals.available).toBe(0);
    });

    it('pending payments do not count as overpayment', () => {
        const totals = computePaymentTotals(600, [{ status: 'PENDING', total: 1000 }]);

        expect(totals.overpaid).toBe(0);
    });

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

    it('reserves awaiting online payments in available but not in remaining', () => {
        const totals = computePaymentTotals(1000, [
            { status: 'CONFIRMED', total: 200 },
            { status: 'AWAITING', total: 300 },
        ]);

        expect(totals.remaining).toBe(800);
        expect(totals.awaitingPaid).toBe(300);
        expect(totals.available).toBe(500);
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
            awaitingPaid: 0,
            hasPending: false,
            remaining: 250,
            available: 250,
            overpaid: 0,
        });
    });
});
