export type ShopPaymentView = {
    id: number;
    amount: unknown;
    status: string;
    paidAt: string | Date;
    userComment?: string | null;
    adminNote?: string | null;
    proofMimeType?: string | null;
    proofObjectKey?: string | null;
    proofData?: unknown;
    children?: { amount: unknown; promoCode: { code: string } | null }[];
};

export function paymentHasProof(payment: {
    proofObjectKey?: string | null;
    proofData?: unknown;
}): boolean {
    return Boolean(payment.proofObjectKey || payment.proofData);
}

export function paymentTotalAmount(payment: ShopPaymentView): number {
    const children = payment.children ?? [];
    const childAmount = children[0] ? Number(children[0].amount) : 0;
    return Number(payment.amount) + childAmount;
}

export const SHOP_PAYMENT_STATUS: Record<
    string,
    { label: string; className: string }
> = {
    PENDING: { label: 'Ожидает подтверждения', className: 'text-warning' },
    CONFIRMED: { label: 'Подтверждено', className: 'text-success' },
    REJECTED: { label: 'Отклонено', className: 'text-error' },
};

/** Суммы по оплатам: в «покрыто» только CONFIRMED; PENDING — до решения админа. */
export type PurchasePaymentSummary = {
    confirmedPaid: number;
    pendingPaid: number;
    hasPending: boolean;
    /** Сколько ещё нужно оплатить (без учёта ожидающих). */
    remaining: number;
    /** Полностью оплачено и нет платежей на проверке. */
    isFullyPaid: boolean;
};

export function summarizePurchasePayments(
    amountDue: number,
    payments: Array<{ status: string; amount: unknown; children?: { amount: unknown }[] }>,
): PurchasePaymentSummary {
    let confirmedPaid = 0;
    let pendingPaid = 0;
    let hasPending = false;

    for (const p of payments) {
        const total = paymentTotalAmount(p as ShopPaymentView);
        if (p.status === 'CONFIRMED') {
            confirmedPaid += total;
        } else if (p.status === 'PENDING') {
            pendingPaid += total;
            hasPending = true;
        }
    }

    const remaining = Math.max(0, amountDue - confirmedPaid);
    const isFullyPaid = !hasPending && remaining <= 1e-6 && confirmedPaid > 0;

    return { confirmedPaid, pendingPaid, hasPending, remaining, isFullyPaid };
}
