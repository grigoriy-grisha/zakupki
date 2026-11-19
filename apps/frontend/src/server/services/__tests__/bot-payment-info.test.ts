import { describe, expect, it } from 'vitest';

import { BotPaymentService } from '../bot-payment.service';

const HOUR = 60 * 60 * 1000;

function makeService(payments: Array<{ status: string; amount: number; expiresAt: Date | null }>) {
    const orderService = {
        findAllByUserWithPriceInfo: async () => [
            {
                amountDue: 1000,
                quantity: 10,
                packageCount: 0,
                priceInfo: null,
                purchaseItem: { purchaseId: 7, purchase: { tag: '#С7' } },
            },
        ],
    };
    const repo = {
        findAllByUserId: async () =>
            payments.map((p, i) => ({ id: i + 1, purchaseId: 7, purchase: { id: 7, tag: '#С7' }, children: [], ...p })),
    };
    const calls: unknown[][] = [];
    const promo = {
        validate: async (...args: unknown[]) => {
            calls.push(args);
            return { id: 1, code: 'X', label: null, discount: 0, finalAmount: 0 };
        },
    };
    return { service: new BotPaymentService(repo as never, orderService as never, promo as never), calls };
}

describe('BotPaymentService: payment info for the bot', () => {
    it('an expired online link does not hold the remaining amount', async () => {
        const { service } = makeService([{ status: 'AWAITING', amount: 1000, expiresAt: new Date(Date.now() - HOUR) }]);
        const info = await service.getPurchasePaymentInfo(1, 7);
        expect(info).toMatchObject({ due: 1000, available: 1000, awaiting: 0 });
    });

    it('a live link still reserves its amount', async () => {
        const { service } = makeService([{ status: 'AWAITING', amount: 400, expiresAt: new Date(Date.now() + HOUR) }]);
        const info = await service.getPurchasePaymentInfo(1, 7);
        expect(info).toMatchObject({ due: 1000, available: 600, awaiting: 400 });
    });

    it('promo minimum is checked against the order total, the discount against the payment', async () => {
        const { service, calls } = makeService([]);
        await service.validatePromoCode(' sale ', 7, 300, 1);
        expect(calls[0]).toEqual(['SALE', 7, 1000, 1, 300]);
    });
});
