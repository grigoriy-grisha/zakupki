export type PaymentTotals = {
    confirmedPaid: number;
    pendingPaid: number;
    hasPending: boolean;
    remaining: number;
    available: number;
};

export type PaymentSummaryInput = {
    status: string;
    total: number;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function computePaymentTotals(due: number, payments: PaymentSummaryInput[]): PaymentTotals {
    let confirmedPaid = 0;
    let pendingPaid = 0;
    let hasPending = false;

    for (const payment of payments) {
        if (payment.status === 'CONFIRMED') {
            confirmedPaid += payment.total;
        } else if (payment.status === 'PENDING') {
            pendingPaid += payment.total;
            hasPending = true;
        }
    }

    const remaining = Math.max(0, round2(due - confirmedPaid));
    const available = Math.max(0, round2(remaining - pendingPaid));

    return { confirmedPaid, pendingPaid, hasPending, remaining, available };
}
