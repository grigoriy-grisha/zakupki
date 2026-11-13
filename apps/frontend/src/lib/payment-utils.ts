import type { PromoCodeType } from '@zakupki/types';
import { computePromoDiscount, roundMoney } from '@zakupki/types';

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

/**
 * Сколько можно перевести с учётом промокода, в копейках (без float-хвостов):
 * 3001.83 − 120.07 в float даёт 2881.7599999…, и ровно введённые 2881.76
 * считались бы «больше максимума».
 */
export function computeMaxTransfer(
    available: number,
    promo: Pick<PaymentPromoInfo, 'type' | 'value' | 'minAmount'> | null,
): number {
    const promoCoversFull = promo != null && (promo.minAmount == null || available >= promo.minAmount);
    const discount = promoCoversFull ? computePromoDiscount(promo.type, promo.value, available) : 0;
    return roundMoney(available - discount);
}

/** Сумма перевода больше допустимой (сравнение в копейках). */
export function exceedsMaxTransfer(amount: number, maxTransfer: number): boolean {
    return roundMoney(amount) > roundMoney(maxTransfer);
}

/**
 * Сумма платежа до скидки по введённой сумме перевода. Не больше остатка:
 * обратный пересчёт процента (перевод / 0.96) округлением иногда даёт +1 копейку
 * сверх остатка, и сервер отклонял «Оплатить всё».
 */
export function computeSubmittedAmount(
    transfer: number,
    available: number,
    promo: Pick<PaymentPromoInfo, 'type' | 'value'> | null,
): number {
    if (!promo || !(transfer > 0)) return transfer;
    const gross =
        promo.type === 'PERCENT'
            ? Math.round((transfer * 10000) / (100 - promo.value)) / 100
            : roundMoney(transfer + promo.value);
    return Math.min(gross, roundMoney(available));
}
