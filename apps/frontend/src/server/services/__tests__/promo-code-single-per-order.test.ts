import { describe, expect, it } from 'vitest';

import { PromoCodeService } from '../promo-code.service';

type FakePromo = {
    id: number;
    code: string;
    label: string | null;
    type: 'PERCENT' | 'FIXED';
    value: number;
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
    purchaseId: number | null;
    minAmount: number | null;
};

const promo = (id: number, code: string, extra: Partial<FakePromo> = {}): FakePromo => ({
    id,
    code,
    label: null,
    type: 'PERCENT',
    value: 10,
    isActive: true,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    purchaseId: null,
    minAmount: null,
    ...extra,
});

const CODES: Record<string, FakePromo> = {
    FIX300: promo(1, 'FIX300', { type: 'FIXED', value: 300 }),
    SALE20: promo(2, 'SALE20', { value: 20 }),
};

function makeService(pinned: FakePromo | null) {
    const repo = { findByCode: async (code: string) => CODES[code] ?? null };
    const paymentRepo = {
        findPinnedPromo: async () => pinned,
        // Фиксированная скидка уже израсходована целиком.
        getPromoDiscountUsed: async () => 300,
    };
    return new PromoCodeService(repo as never, paymentRepo as never);
}

describe('PromoCodeService: one promo code per order', () => {
    it('rejects a second code when another one is already used on the order', async () => {
        const service = makeService(CODES.FIX300);
        await expect(
            service.resolveForSubmit({ userId: 1, purchaseId: 5, code: 'SALE20', amount: 600, due: 900 }),
        ).rejects.toThrow('К заказу уже применён промокод FIX300');
        await expect(service.validate('SALE20', 5, 600, 1)).rejects.toThrow('уже применён промокод FIX300');
    });

    it('accepts the same code again and a first code on a clean order', async () => {
        const pinned = makeService(CODES.SALE20);
        await expect(
            pinned.resolveForSubmit({ userId: 1, purchaseId: 5, code: 'sale20', amount: 500, due: 500 }),
        ).resolves.toEqual({ promoCodeId: 2, discountAmount: 100 });

        const clean = makeService(null);
        await expect(
            clean.resolveForSubmit({ userId: 1, purchaseId: 5, code: 'SALE20', amount: 500, due: 500 }),
        ).resolves.toEqual({ promoCodeId: 2, discountAmount: 100 });
        await expect(clean.validate('SALE20', 5, 500, 1)).resolves.toMatchObject({ discount: 100 });
    });
});

describe('PromoCodeService: minimum order amount', () => {
    const MIN = promo(3, 'MIN1000', { minAmount: 1000 });
    const withCode = (pinned: FakePromo | null) => {
        const repo = { findByCode: async () => MIN };
        const paymentRepo = { findPinnedPromo: async () => pinned, getPromoDiscountUsed: async () => 0 };
        return new PromoCodeService(repo as never, paymentRepo as never);
    };

    it('a pinned code keeps working after the order dropped below the minimum', async () => {
        const service = withCode(MIN);
        await expect(
            service.resolveForSubmit({ userId: 1, purchaseId: 5, code: 'MIN1000', amount: 300, due: 800 }),
        ).resolves.toEqual({ promoCodeId: 3, discountAmount: 30 });
        await expect(service.validate('MIN1000', 5, 800, 1, 300)).resolves.toMatchObject({ discount: 30 });
    });

    it('a new code is checked against the order total, the discount is taken from the payment', async () => {
        const service = withCode(null);
        await expect(service.validate('MIN1000', 5, 800, 1, 300)).rejects.toThrow('Минимальная сумма заказа');
        await expect(service.validate('MIN1000', 5, 1500, 1, 300)).resolves.toMatchObject({
            discount: 30,
            finalAmount: 270,
        });
    });
});
