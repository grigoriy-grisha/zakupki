import { InlineKeyboard } from 'grammy';

import type { PromoCodeApplied } from '../domain/types';
import { escapeHtml } from './html';

const rub = (value: number): string => `${value.toLocaleString('ru-RU')} ₽`;

export function priceChangeLine(amount: number, promo?: PromoCodeApplied | null): string {
    if (!promo) return `<b>${rub(amount)}</b>`;
    return `<s>${rub(amount)}</s> → <b>${rub(promo.finalAmount)}</b>`;
}

export function proofStepText(
    amount: number,
    promo?: PromoCodeApplied | null,
    opts?: { pinned?: boolean },
): string {
    const parts: string[] = [];
    if (promo && opts?.pinned) {
        parts.push(`🔒 Промокод ${escapeHtml(promo.code)} закреплён за заказом`);
    } else if (promo) {
        parts.push(`✅ Промокод ${escapeHtml(promo.code)} применён`);
    }
    parts.push(`К оплате: ${priceChangeLine(amount, promo)}`);
    if (promo) parts.push(`Скидка: ${rub(promo.discount)}`);
    parts.push(
        '',
        '📎 Пришлите фото или PDF чека.',
        'Подпись к файлу сохранится как комментарий.',
        '',
        '/cancel — отменить',
    );
    return parts.join('\n');
}

export function paymentSubmittedText(tag: string, transfer: number, promo?: PromoCodeApplied | null): string {
    const promoLine = promo ? `\n🎁 Скидка по промокоду ${escapeHtml(promo.code)}: ${rub(promo.discount)}` : '';
    return `✅ Оплата <b>${rub(transfer)}</b> по закупке «${escapeHtml(tag)}» отправлена на проверку.${promoLine}\nСтатус: /payments`;
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

export function paymentsCancelKeyboard(payments: CancelablePayment[]): InlineKeyboard | undefined {
    const keyboard = new InlineKeyboard();
    let hasButtons = false;
    for (const payment of payments) {
        if (payment.status !== 'PENDING') continue;
        const total = (payment.children ?? []).reduce((s, c) => s + Number(c.amount), Number(payment.amount));
        keyboard.text(`✖ Отменить оплату ${total.toLocaleString('ru-RU')} ₽`, `pay:cancel:${payment.id}`).row();
        hasButtons = true;
    }
    return hasButtons ? keyboard : undefined;
}
