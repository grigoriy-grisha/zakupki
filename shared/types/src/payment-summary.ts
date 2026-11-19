import { roundMoney } from './pricing/currency-pricing';

export type PaymentTotals = {
    confirmedPaid: number;
    pendingPaid: number;
    /** Сумма незавершённых онлайн-платежей (AWAITING). */
    awaitingPaid: number;
    hasPending: boolean;
    remaining: number;
    available: number;
    /** Подтверждённых оплат больше, чем стоит заказ (админ убрал позиции после оплаты). */
    overpaid: number;
};

export type PaymentSummaryInput = {
    status: string;
    total: number;
};

export function computePaymentTotals(due: number, payments: PaymentSummaryInput[]): PaymentTotals {
    let confirmedPaid = 0;
    let pendingPaid = 0;
    let hasPending = false;
    let awaitingPaid = 0;

    for (const payment of payments) {
        if (payment.status === 'CONFIRMED') {
            confirmedPaid += payment.total;
        } else if (payment.status === 'PENDING') {
            pendingPaid += payment.total;
            hasPending = true;
        } else if (payment.status === 'AWAITING') {
            // Онлайн-платёж открыт в Т-Банке: резервируем сумму, чтобы не переплатить со второй вкладки.
            awaitingPaid += payment.total;
        }
    }

    const remaining = Math.max(0, roundMoney(due - confirmedPaid));
    const available = Math.max(0, roundMoney(remaining - pendingPaid - awaitingPaid));
    const overpaid = Math.max(0, roundMoney(confirmedPaid - due));

    return { confirmedPaid, pendingPaid, awaitingPaid, hasPending, remaining, available, overpaid };
}
