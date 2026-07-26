/**
 * Статус оплаты участника по суммам due/paid.
 *
 * Единая логика для бейджа в карточке участника и для фильтра списка.
 * Пороговое сравнение — с допуском epsilon: Decimal (10,2) суммы платежей и
 * заказов могут расходиться на сотые из-за округления, поэтому строгое >=
 * иногда не срабатывает на «ровно оплаченных» (см. баг с промокодом).
 */
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

const EPSILON = 0.01;

export function getPaymentStatus(due: number, paid: number): PaymentStatus {
    if (due <= EPSILON) return 'unpaid';
    if (paid >= due - EPSILON) return 'paid';
    if (paid > EPSILON) return 'partial';
    return 'unpaid';
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    paid: 'Оплачено',
    partial: 'Частично',
    unpaid: 'Не оплачено',
};
