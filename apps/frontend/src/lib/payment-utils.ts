import type { PromoCodeType } from '@zakupki/types';
import { computePromoDiscount, roundMoney } from '@zakupki/types';

export function paymentTotal(p: { amount: unknown; children?: { amount: unknown }[] | null }): number {
    const children = p.children ?? [];
    const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
    return Number(p.amount) + childAmount;
}

type PaymentLike = {
    amount: unknown;
    method?: string | null;
    refundOfId?: number | null;
    children?: Array<{ amount: unknown; promoCode?: { code: string } | null }> | null;
};

/** Как оплата выглядит для клиента: «картой» / «через СБП», для ручной — null. */
export function onlineMethodLabel(method: string | null | undefined): string | null {
    if (method === 'TBANK_SBP') return 'через СБП';
    if (method === 'TBANK_CARD') return 'картой';
    return null;
}

/**
 * Общие поля для строки оплаты в магазине и админке.
 * Возврат показываем суммой, которую реально вернули на карту (без отменённой доли скидки).
 */
export function describePayment(p: PaymentLike) {
    const isRefund = p.refundOfId != null;
    const child = p.children?.[0];
    return {
        isRefund,
        total: isRefund ? Number(p.amount) : paymentTotal(p),
        promoAmount: child ? Number(child.amount) : 0,
        promoCode: child?.promoCode?.code,
        methodLabel: isRefund ? null : onlineMethodLabel(p.method),
    };
}

export type PaymentPromoInfo = {
    id: number;
    code: string;
    type: PromoCodeType;
    value: number;
    minAmount: number | null;
};

type PromoChild = {
    amount?: unknown;
    promoCodeId?: number | null;
    promoCode?: { id: number; code: string; type: string; value: unknown; minAmount: unknown } | null;
} | null;

/**
 * Промокод, закреплённый за заказом прошлой оплатой. Для фиксированной скидки `value` —
 * сколько скидки ещё осталось (как считает сервер), иначе клиент видел бы одну сумму, а банк
 * списал бы другую.
 */
export function findPinnedPromo(
    payments: Array<{
        status: string;
        children?: unknown;
    }>,
): PaymentPromoInfo | undefined {
    const live = payments.filter((p) => p.status !== 'REJECTED');
    let pinned: PaymentPromoInfo | undefined;
    for (const payment of live) {
        const children = (payment.children ?? []) as PromoChild[];
        const promo = children.find((c) => c?.promoCode)?.promoCode;
        if (promo) {
            pinned = {
                id: promo.id,
                code: promo.code,
                type: promo.type as PromoCodeType,
                value: Number(promo.value),
                minAmount: promo.minAmount != null ? Number(promo.minAmount) : null,
            };
            break;
        }
    }
    if (!pinned || pinned.type !== 'FIXED') return pinned;

    let used = 0;
    for (const payment of live) {
        for (const child of (payment.children ?? []) as PromoChild[]) {
            const childPromoId = child?.promoCodeId ?? child?.promoCode?.id;
            if (childPromoId === pinned.id) used += Number(child?.amount ?? 0);
        }
    }
    const budgetLeft = Math.max(0, roundMoney(pinned.value - used));
    return budgetLeft > 0 ? { ...pinned, value: budgetLeft } : undefined;
}

/**
 * Сколько можно перевести с учётом промокода, в копейках (без float-хвостов):
 * 3001.83 − 120.07 в float даёт 2881.7599999…, и ровно введённые 2881.76
 * считались бы «больше максимума».
 */
export function computeMaxTransfer(
    available: number,
    promo: Pick<PaymentPromoInfo, 'type' | 'value' | 'minAmount'> | null,
    /** Сумма всего заказа: минимальную сумму промокода сервер сверяет с ней, а не с остатком. */
    due: number = available,
): number {
    const promoCoversFull = promo != null && (promo.minAmount == null || due >= promo.minAmount);
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
