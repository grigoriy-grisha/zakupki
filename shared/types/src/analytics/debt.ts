import { computePaymentTotals } from '../payment-summary';
import { roundMoney } from '../pricing/currency-pricing';

export type ParticipantDueRow = { purchaseId: number; userId: number; due: number };

/** Платёж верхнего уровня: total = сумма + промо-скидки (дочерние платежи). */
export type ParticipantPaymentRow = { purchaseId: number; userId: number; status: string; total: number };

export type PurchaseDebtSummary = {
    purchaseId: number;
    participants: number;
    due: number;
    /** Покрыто подтверждёнными оплатами и промокодами. */
    confirmed: number;
    /** Ручные оплаты на проверке. */
    pending: number;
    /** Открытые онлайн-оплаты. */
    awaiting: number;
    debt: number;
    debtors: number;
};

/**
 * Долг по закупкам: по каждому участнику max(0, к оплате − подтверждено),
 * теми же правилами, что видит сам участник (computePaymentTotals).
 */
export function summarizePurchaseDebts(
    dues: readonly ParticipantDueRow[],
    payments: readonly ParticipantPaymentRow[],
): Map<number, PurchaseDebtSummary> {
    const key = (purchaseId: number, userId: number) => `${purchaseId}:${userId}`;
    const participants = new Map<string, { purchaseId: number; due: number; payments: ParticipantPaymentRow[] }>();

    for (const row of dues) {
        const entry = participants.get(key(row.purchaseId, row.userId));
        if (entry) entry.due += row.due;
        else
            participants.set(key(row.purchaseId, row.userId), {
                purchaseId: row.purchaseId,
                due: row.due,
                payments: [],
            });
    }
    for (const payment of payments) {
        const entry = participants.get(key(payment.purchaseId, payment.userId));
        // Оплата без заказа (заказ отменён) долга не создаёт и в сводку не входит.
        if (entry) entry.payments.push(payment);
    }

    const result = new Map<number, PurchaseDebtSummary>();
    for (const { purchaseId, due, payments: list } of participants.values()) {
        if (due <= 0) continue;
        const totals = computePaymentTotals(due, list);
        const summary = result.get(purchaseId) ?? {
            purchaseId,
            participants: 0,
            due: 0,
            confirmed: 0,
            pending: 0,
            awaiting: 0,
            debt: 0,
            debtors: 0,
        };
        summary.participants += 1;
        summary.due += due;
        summary.confirmed += Math.min(totals.confirmedPaid, due);
        summary.pending += totals.pendingPaid;
        summary.awaiting += totals.awaitingPaid;
        summary.debt += totals.remaining;
        if (totals.remaining > 0) summary.debtors += 1;
        result.set(purchaseId, summary);
    }

    for (const summary of result.values()) {
        summary.due = roundMoney(summary.due);
        summary.confirmed = roundMoney(summary.confirmed);
        summary.pending = roundMoney(summary.pending);
        summary.awaiting = roundMoney(summary.awaiting);
        summary.debt = roundMoney(summary.debt);
    }
    return result;
}
