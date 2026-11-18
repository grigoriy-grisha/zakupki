import { InlineKeyboard } from 'grammy';

import type { PromoCodeApplied } from '../domain/types';

const rub = (value: number): string => `${value.toLocaleString('ru-RU')} ₽`;

export function priceChangeLine(amount: number, promo?: PromoCodeApplied | null): string {
    if (!promo) return `<b>${rub(amount)}</b>`;
    return `<s>${rub(amount)}</s> → <b>${rub(promo.finalAmount)}</b>`;
}

export function paymentsListText(count: number, lines: string[]): string {
    if (count === 0) return 'У вас пока нет оплат.';
    return `Ваши оплаты (последние ${count}):\n\n` + lines.join('\n\n');
}

type CancelablePayment = {
    id: number;
    status: string;
    amount: unknown;
    children?: Array<{ amount: unknown }> | null;
};

/** Подсказка, когда вся сумма уже зарезервирована неоплаченной ссылкой. */
export const AWAITING_LINK_HINT =
    'Ссылка на оплату уже создана — откройте её кнопкой «Оплатить» в сообщении со ссылкой.\n' +
    'Чтобы создать новую, сначала отмените старую в /payments.';

export function paymentsCancelKeyboard(payments: CancelablePayment[]): InlineKeyboard | undefined {
    const keyboard = new InlineKeyboard();
    let hasButtons = false;
    for (const payment of payments) {
        if (payment.status !== 'PENDING' && payment.status !== 'AWAITING') continue;
        const total = (payment.children ?? []).reduce((s, c) => s + Number(c.amount), Number(payment.amount));
        const label = payment.status === 'AWAITING' ? 'Отменить ссылку на' : 'Отменить оплату';
        keyboard.text(`✖ ${label} ${total.toLocaleString('ru-RU')} ₽`, `pay:cancel:${payment.id}`).row();
        hasButtons = true;
    }
    return hasButtons ? keyboard : undefined;
}
