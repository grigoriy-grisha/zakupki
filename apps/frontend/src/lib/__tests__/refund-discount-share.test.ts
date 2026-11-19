import { describe, expect, it } from 'vitest';

import { computeRefundDiscountShare, refundForOverpayment } from '../payment-utils';

// Оплата 900 ₽ деньгами + 100 ₽ скидки по промокоду.
const base = { paid: 900, discount: 100, refundedBefore: 0, discountReversedBefore: 0 };

describe('computeRefundDiscountShare', () => {
    it('cancels the discount in proportion to the refunded money', () => {
        expect(computeRefundDiscountShare({ ...base, amount: 360 })).toBe(40);
        expect(computeRefundDiscountShare({ ...base, amount: 400 })).toBe(44.44);
    });

    it('a full refund cancels the whole remaining discount', () => {
        expect(computeRefundDiscountShare({ ...base, amount: 900 })).toBe(100);
        expect(
            computeRefundDiscountShare({ ...base, refundedBefore: 360, discountReversedBefore: 40, amount: 540 }),
        ).toBe(60);
    });

    it('no discount — nothing to cancel', () => {
        expect(computeRefundDiscountShare({ ...base, discount: 0, amount: 400 })).toBe(0);
    });
});

describe('refundForOverpayment', () => {
    it('overpayment 400 ₽ with a 10% promo is closed by refunding 360 ₽, not 400', () => {
        const r = refundForOverpayment({ ...base, overpaid: 400, maxRefund: 900 });
        expect(r).toBe(360);
        expect(r + computeRefundDiscountShare({ ...base, amount: r })).toBe(400);
    });

    it('never leaves a debt: refund + cancelled discount never exceed the overpayment', () => {
        for (let o = 1; o <= 1000; o += 7.31) {
            const overpaid = Math.round(o * 100) / 100;
            const r = refundForOverpayment({ ...base, overpaid, maxRefund: 900 });
            const cost = r + computeRefundDiscountShare({ ...base, amount: r });
            expect(Math.round(cost * 100)).toBeLessThanOrEqual(Math.round(overpaid * 100));
            expect(overpaid - cost).toBeLessThan(1.2);
        }
    });

    it('without a promo the whole overpayment is refunded, capped by the payment', () => {
        const noPromo = { ...base, discount: 0 };
        expect(refundForOverpayment({ ...noPromo, overpaid: 400, maxRefund: 900 })).toBe(400);
        expect(refundForOverpayment({ ...noPromo, overpaid: 1400, maxRefund: 900 })).toBe(900);
    });
});
