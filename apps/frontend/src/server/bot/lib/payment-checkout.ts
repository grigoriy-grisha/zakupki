import { roundMoney } from '@zakupki/types';
import { InlineKeyboard } from 'grammy';

import { computeOnlineFee, SBP_MIN_TOTAL } from '@/lib/online-payment-fee';

import type { ServiceContainer } from '../container/service-container';
import type { CustomContext, PromoCodeApplied } from '../domain/types';
import { escapeHtml } from './html';
import { priceChangeLine } from './payment-texts';

const rub = (value: number): string => `${value.toLocaleString('ru-RU')} ₽`;

type OnlineConfig = Awaited<ReturnType<ServiceContainer['paymentService']['getOnlineConfig']>>;

const totalWithFee = (net: number, percent: number): number => roundMoney(net + computeOnlineFee(net, percent));

function methodButtonLabel(title: string, net: number, percent: number): string {
    return `${title} — ${rub(totalWithFee(net, percent))}`;
}

/** Строка про комиссию банка для способа оплаты — как в магазине. */
function feeLine(title: string, net: number, percent: number): string {
    const fee = computeOnlineFee(net, percent);
    if (fee <= 0) return `${title}: ${rub(net)} — без комиссии`;
    return `${title}: ${rub(totalWithFee(net, percent))} — с комиссией банка ${percent}% (${rub(fee)})`;
}

/**
 * Сумма и промокод выбраны: спрашиваем контакт для чека (если его нет) или сразу способ оплаты.
 */
export async function continueToCheckout(
    ctx: CustomContext,
    container: ServiceContainer,
    amount: number,
    promo?: PromoCodeApplied,
    opts?: { pinned?: boolean },
): Promise<void> {
    const flow = container.flowFor(ctx);
    const config = await container.paymentService.getOnlineConfig(ctx.session.userId!);
    if (!config.enabled) {
        flow.clear();
        await ctx.reply('Онлайн-оплата временно недоступна. Попробуйте позже.');
        return;
    }

    const promoLines: string[] = [];
    if (promo && opts?.pinned) promoLines.push(`🔒 Промокод ${escapeHtml(promo.code)} закреплён за заказом`);
    else if (promo) promoLines.push(`✅ Промокод ${escapeHtml(promo.code)} применён`);

    if (config.receiptEnabled && !config.receiptContact) {
        flow.advanceToCheckout('contact', promo);
        await ctx.reply(
            [
                ...promoLines,
                `К оплате: ${priceChangeLine(amount, promo)}`,
                '',
                '🧾 Напишите email или номер телефона — туда придёт электронный чек.',
                '',
                '/cancel — отменить',
            ].join('\n'),
            { parse_mode: 'HTML' },
        );
        return;
    }

    flow.advanceToCheckout('method', promo);
    await sendMethodChoice(ctx, container, amount, promo, promoLines, config);
}

export async function sendMethodChoice(
    ctx: CustomContext,
    container: ServiceContainer,
    amount: number,
    promo?: PromoCodeApplied,
    promoLines: string[] = [],
    preloaded?: OnlineConfig,
): Promise<void> {
    const config = preloaded ?? (await container.paymentService.getOnlineConfig(ctx.session.userId!));
    const net = roundMoney(promo ? promo.finalAmount : amount);
    const keyboard = new InlineKeyboard().text(methodButtonLabel('💳 Картой', net, config.cardFeePercent), 'pay:card');
    const sbpAllowed = totalWithFee(net, config.sbpFeePercent) >= SBP_MIN_TOTAL;
    if (sbpAllowed) {
        keyboard.row().text(methodButtonLabel('⚡ По СБП', net, config.sbpFeePercent), 'pay:sbp');
    }
    const feeLines = [
        feeLine('💳 Картой', net, config.cardFeePercent),
        sbpAllowed ? feeLine('⚡ По СБП', net, config.sbpFeePercent) : null,
    ];

    await ctx.reply(
        [
            ...promoLines,
            `К оплате: ${priceChangeLine(amount, promo)}`,
            promo ? `Скидка: ${rub(promo.discount)}` : null,
            '',
            ...feeLines,
            '',
            'Выберите способ оплаты — пришлю ссылку на защищённую страницу Т-Банка.',
            '',
            '/cancel — отменить',
        ]
            .filter((line): line is string => line !== null)
            .join('\n'),
        { parse_mode: 'HTML', reply_markup: keyboard },
    );
}
