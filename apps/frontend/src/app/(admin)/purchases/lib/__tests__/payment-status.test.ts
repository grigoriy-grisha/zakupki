import { describe, expect, it } from 'vitest';

import { getPaymentStatus } from '../payment-status';

describe('getPaymentStatus', () => {
    it('unpaid when nothing paid', () => {
        expect(getPaymentStatus(1000, 0)).toBe('unpaid');
    });

    it('partial when paid below due', () => {
        expect(getPaymentStatus(1000, 400)).toBe('partial');
    });

    it('paid when paid covers due (epsilon-tolerant)', () => {
        expect(getPaymentStatus(1000, 1000)).toBe('paid');
        expect(getPaymentStatus(1000, 999.995)).toBe('paid');
    });

    it('overpaid when paid exceeds due beyond epsilon', () => {
        expect(getPaymentStatus(1000, 1200)).toBe('overpaid');
        expect(getPaymentStatus(1000, 1000.02)).toBe('overpaid');
    });

    it('paid at the epsilon boundary, not overpaid', () => {
        expect(getPaymentStatus(1000, 1000.01)).toBe('paid');
    });

    it('overpaid when due is zero but payments exist', () => {
        expect(getPaymentStatus(0, 500)).toBe('overpaid');
    });

    it('unpaid when both due and paid are zero', () => {
        expect(getPaymentStatus(0, 0)).toBe('unpaid');
    });
});
