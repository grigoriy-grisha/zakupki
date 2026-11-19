import type { PromoCodeType } from '@zakupki/types';
import { computePromoDiscount, roundMoney } from '@zakupki/types';

export function paymentTotal(p: { amount: unknown; children?: { amount: unknown }[] | null }): number {
    const children = p.children ?? [];
    const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
    return Number(p.amount) + childAmount;
}

/** Ссылка на онлайн-оплату ещё действует (срок не вышел). */
export function isLiveAwaiting(p: { status: string; expiresAt?: Date | string | null }, now = Date.now()): boolean {
    return p.status === 'AWAITING' && (!p.expiresAt || new Date(p.expiresAt).getTime() > now);
}

export type RefundDiscountInput = {
    /** Сколько клиент заплатил деньгами по оплате (без скидки). */
    paid: number;
    /** Скидка по промокоду, которая была в этой оплате. */
    discount: number;
    /** Сколько денег по оплате уже вернули раньше. */
    refundedBefore: number;
    /** Сколько скидки уже отменили прошлыми возвратами. */
    discountReversedBefore: number;
};

/**
 * Какая часть скидки по промокоду отменяется вместе с возвратом: доля скидки пропорционально
 * возвращённым деньгам, при полном возврате — вся оставшаяся скидка. Одна формула для сервера
 * и окна возврата в админке.
 */
export function computeRefundDiscountShare(p: RefundDiscountInput & { amount: number }): number {
    const discountLeft = roundMoney(p.discount - p.discountReversedBefore);
    if (discountLeft <= 0 || p.paid <= 0 || p.amount <= 0) return 0;
    const isFull = Math.round((p.refundedBefore + p.amount) * 100) >= Math.round(p.paid * 100);
    if (isFull) return discountLeft;
    return Math.max(0, Math.min(discountLeft, roundMoney((p.discount * p.amount) / p.paid)));
}

/**
 * Сколько вернуть деньгами, чтобы снять переплату и не создать долг. Вместе с возвратом
 * отменяется доля скидки, поэтому «вернуть всю переплату» оставляло клиенту ложный долг:
 * переплата 400 ₽ при скидке 10% — вернуть нужно 360 ₽, а не 400.
 */
export function refundForOverpayment(p: RefundDiscountInput & { overpaid: number; maxRefund: number }): number {
    if (p.overpaid <= 0 || p.maxRefund <= 0) return 0;
    const costOf = (r: number) => r + computeRefundDiscountShare({ ...p, amount: r });
    const fits = (r: number) => Math.round(costOf(r) * 100) <= Math.round(p.overpaid * 100);
    const discountLeft = Math.max(0, p.discount - p.discountReversedBefore);
    let r = Math.min(p.maxRefund, roundMoney((p.overpaid * p.paid) / (p.paid + (discountLeft > 0 ? p.discount : 0))));
    while (r > 0 && !fits(r)) r = roundMoney(r - 0.01);
    while (r + 0.01 <= p.maxRefund + 1e-9 && fits(roundMoney(r + 0.01))) r = roundMoney(r + 0.01);
    return Math.max(0, r);
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
 * Перевод на весь максимум закрывает весь остаток: обратный пересчёт мог дать на копейку
 * меньше, и после «Оплатить всё» оставался долг 0,01 ₽, который уже нельзя оплатить онлайн.
 */
export function computeSubmittedAmount(
    transfer: number,
    available: number,
    promo: Pick<PaymentPromoInfo, 'type' | 'value'> | null,
): number {
    if (!promo || !(transfer > 0)) return transfer;
    const fullTransfer = roundMoney(available - computePromoDiscount(promo.type, promo.value, available));
    if (roundMoney(transfer) >= fullTransfer) return roundMoney(available);
    const gross =
        promo.type === 'PERCENT'
            ? Math.round((transfer * 10000) / (100 - promo.value)) / 100
            : roundMoney(transfer + promo.value);
    return Math.min(gross, roundMoney(available));
}
