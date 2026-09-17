import { computePromoDiscount, type PromoCodeType } from '@zakupki/types';

import type { PromoCodeApplied } from '../domain/types';

type PinnedPromoLike = {
    id: number;
    code: string;
    type: string;
    value: unknown;
};

export function buildPinnedPromo(promo: PinnedPromoLike | null | undefined, amount: number): PromoCodeApplied | null {
    if (!promo || !(amount > 0)) return null;
    const discount = computePromoDiscount(promo.type as PromoCodeType, Number(promo.value), amount);
    if (discount <= 0) return null;
    return { id: promo.id, code: promo.code, discount, finalAmount: amount - discount };
}
