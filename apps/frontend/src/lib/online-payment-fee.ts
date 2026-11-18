import { roundMoney } from '@zakupki/types';

/** Минимальная сумма оплаты по СБП у Т-Банка, ₽. */
export const SBP_MIN_TOTAL = 10;

/** Комиссия банка за онлайн-оплату. Общая для сервера, бота и магазина, чтобы суммы совпадали везде. */
export function computeOnlineFee(amount: number, percent: number): number {
    if (!(amount > 0) || percent <= 0) return 0;
    return roundMoney((amount * percent) / 100);
}
