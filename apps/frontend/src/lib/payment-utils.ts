import type { PromoCodeType } from '@zakupki/types';

export const PAYMENT_DETAILS = {
    method: 'СБП (Система быстрых платежей)',
    phone: '+79836236373',
    recipient: 'Щеглова Ксения Вячеславовна',
    banks: 'СБЕР, Т-банк',
} as const;

export function paymentTotal(p: { amount: unknown; children?: { amount: unknown }[] }): number {
    const children = p.children ?? [];
    const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
    return Number(p.amount) + childAmount;
}

export type PaymentPromoInfo = {
    id: number;
    code: string;
    type: PromoCodeType;
    value: number;
    minAmount: number | null;
};

export function findPinnedPromo(
    payments: Array<{
        status: string;
        children?: unknown;
    }>,
): PaymentPromoInfo | undefined {
    for (const payment of payments) {
        if (payment.status === 'REJECTED') continue;
        const children = (payment.children ?? []) as Array<{
            promoCode?: { id: number; code: string; type: string; value: unknown; minAmount: unknown } | null;
        } | null>;
        for (const child of children) {
            const promo = child?.promoCode;
            if (promo) {
                return {
                    id: promo.id,
                    code: promo.code,
                    type: promo.type as PromoCodeType,
                    value: Number(promo.value),
                    minAmount: promo.minAmount != null ? Number(promo.minAmount) : null,
                };
            }
        }
    }
    return undefined;
}
