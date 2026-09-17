import { computePaymentTotals, type PaymentTotals } from '@zakupki/types';

import { paymentTotal } from '@/lib/payment-utils';

export type ShopPaymentView = {
    id: number;
    amount: unknown;
    status: string;
    submittedAt: string | Date;
    userComment?: string | null;
    adminNote?: string | null;
    proofObjectKey?: string | null;
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
    CONFIRMED: { label: 'Подтверждено', className: 'text-success' },
    REJECTED: { label: 'Отклонено', className: 'text-error' },
};

export type PurchasePaymentSummary = PaymentTotals & {
    isFullyPaid: boolean;
};

export function summarizePurchasePayments(
    amountDue: number,
    payments: Array<{ status: string; amount: unknown; children?: { amount: unknown }[] }>,
): PurchasePaymentSummary {
    const totals = computePaymentTotals(
        amountDue,
        payments.map((p) => ({ status: p.status, total: paymentTotal(p) })),
    );

    return {
        ...totals,
        isFullyPaid: !totals.hasPending && totals.remaining <= 1e-6 && totals.confirmedPaid > 0,
    };
}
