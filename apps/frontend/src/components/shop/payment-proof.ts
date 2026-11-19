import { computePaymentTotals, type PaymentTotals } from '@zakupki/types';

import { isLiveAwaiting, paymentTotal } from '@/lib/payment-utils';

export type ShopPaymentView = {
    id: number;
    amount: unknown;
    status: string;
    submittedAt: string | Date;
    userComment?: string | null;
    adminNote?: string | null;
    proofObjectKey?: string | null;
    method?: string | null;
    /** Возврат денег клиенту (сумма отрицательная). */
    refundOfId?: number | null;
    feeAmount?: unknown;
    paymentUrl?: string | null;
    expiresAt?: string | Date | null;
    children?: { amount: unknown; promoCode: { code: string } | null }[];
};

export function paymentHasProof(payment: { proofObjectKey?: string | null }): boolean {
    return Boolean(payment.proofObjectKey);
}

export function paymentProofIsImage(payment: { proofObjectKey?: string | null }): boolean {
    if (!payment.proofObjectKey) return false;
    const ext = payment.proofObjectKey.split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif';
}

export const SHOP_PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Ожидает подтверждения', className: 'text-warning' },
    AWAITING: { label: 'Не оплачено', className: 'text-fg-secondary' },
    CONFIRMED: { label: 'Подтверждено', className: 'text-success' },
    REJECTED: { label: 'Отклонено', className: 'text-error' },
};

export type PurchasePaymentSummary = PaymentTotals & {
    isFullyPaid: boolean;
};

export { isLiveAwaiting };

export function summarizePurchasePayments(
    amountDue: number,
    payments: Array<{
        status: string;
        amount: unknown;
        expiresAt?: Date | string | null;
        children?: { amount: unknown }[];
    }>,
): PurchasePaymentSummary {
    // Истёкшую ссылку сервер закроет сам (сверка раз в 5 минут, а при новой оплате — сразу),
    // поэтому её сумму клиенту уже не резервируем — иначе кнопка «Оплатить» пропадала бы до сверки.
    const totals = computePaymentTotals(
        amountDue,
        payments
            .filter((p) => p.status !== 'AWAITING' || isLiveAwaiting(p))
            .map((p) => ({ status: p.status, total: paymentTotal(p) })),
    );

    return {
        ...totals,
        isFullyPaid: !totals.hasPending && totals.remaining <= 1e-6 && totals.confirmedPaid > 0,
    };
}
