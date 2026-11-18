import { InlineKeyboard } from 'grammy';

import type { ServiceContainer } from '../../container/service-container';
import type { CallbackAction } from '../../domain/callback-data';
import type { CallbackHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { escapeHtml } from '../../lib/html';
import { continueToCheckout } from '../../lib/payment-checkout';
import { PAID_START_PAYLOAD } from '../../lib/payment-return';
import { AWAITING_LINK_HINT, paymentsCancelKeyboard, paymentsListText } from '../../lib/payment-texts';
import { buildPinnedPromo } from '../../lib/pinned-promo';
import { userErrorMessage } from '../../lib/user-error';
import type { BotPurchasePaymentInfo } from '../../services/bot/bot-payment.service';

const STALE_BUTTON_TEXT = 'Эта кнопка устарела. Начните оплату заново: /pay';

function formatBreakdown(info: BotPurchasePaymentInfo): string {
    const breakdown = info.breakdown;
    if (!breakdown || (breakdown.org <= 0 && breakdown.delivery <= 0)) return '';
    const lines = [`Стоимость выбранных товаров: ${breakdown.base.toLocaleString('ru-RU')} ₽`];
    if (breakdown.org > 0) lines.push(`Оргсбор: ${breakdown.org.toLocaleString('ru-RU')} ₽`);
    if (breakdown.delivery > 0) lines.push(`Доставка: ${breakdown.delivery.toLocaleString('ru-RU')} ₽`);
    return lines.join('\n');
}

export class PayCallbackQueryHandler implements CallbackHandler {
    readonly prefix = 'pay:';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, action: CallbackAction): Promise<void> {
        const userId = ctx.session.userId!;

        if (action.kind === 'pay:pick') {
            await this.handlePick(ctx, userId, action.purchaseId);
            return;
        }

        if (action.kind === 'pay:all') {
            await this.handlePreset(ctx, userId, action.purchaseId, 100);
            return;
        }

        if (action.kind === 'pay:part') {
            await this.handlePreset(ctx, userId, action.purchaseId, action.percent);
            return;
        }

        if (action.kind === 'pay:promo') {
            await this.handlePromo(ctx);
            return;
        }

        if (action.kind === 'pay:skip') {
            await this.handleSkip(ctx);
            return;
        }

        if (action.kind === 'pay:method') {
            await this.handleMethod(ctx, userId, action.method);
            return;
        }

        if (action.kind === 'pay:cancel') {
            await this.handleCancel(ctx, userId, action.paymentId);
            return;
        }

        await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
    }

    private async handleCancel(ctx: CustomContext, userId: number, paymentId: number): Promise<void> {
        try {
            await this.container.paymentService.cancelPayment(userId, paymentId);
        } catch (err) {
            const msg = userErrorMessage(err, 'Не удалось отменить оплату');
            await ctx.answerCallbackQuery({ text: msg, show_alert: true }).catch(() => undefined);
            return;
        }

        await ctx.answerCallbackQuery({ text: 'Оплата отменена' });

        const { payments, lines } = await this.container.paymentService.getUserPayments(userId);
        const keyboard = paymentsCancelKeyboard(payments);
        await ctx
            .editMessageText(paymentsListText(payments.length, lines), { reply_markup: keyboard })
            .catch(() => undefined);
    }

    private async handlePick(ctx: CustomContext, userId: number, purchaseId: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.available <= 0) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            await ctx.editMessageText(
                info && info.awaiting > 0
                    ? AWAITING_LINK_HINT
                    : 'Эта закупка больше недоступна для оплаты. Нажмите /pay снова.',
            );
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startAmountStep(purchaseId, info.tag, info.available);

        const partAmount = Math.round(info.available * 0.7 * 100) / 100;
        const keyboard = new InlineKeyboard();
        if (partAmount > 0 && partAmount < info.available) {
            keyboard.text(`Оплатить 70% (${partAmount.toLocaleString('ru-RU')} ₽)`, `pay:part:${purchaseId}:70`).row();
        }
        keyboard.text(`Оплатить всё (${info.available.toLocaleString('ru-RU')} ₽)`, `pay:all:${purchaseId}`);

        await ctx.answerCallbackQuery();
        const breakdownText = formatBreakdown(info);
        const pendingLine =
            (info.pending > 0 ? `\n<i>На проверке: ${info.pending.toLocaleString('ru-RU')} ₽</i>` : '') +
            (info.awaiting > 0
                ? `\n<i>Уже есть неоплаченная ссылка на ${info.awaiting.toLocaleString('ru-RU')} ₽ — её можно открыть ` +
                  `кнопкой «Оплатить» в сообщении со ссылкой. Здесь можно оплатить остальное.</i>`
                : '');
        await ctx.editMessageText(
            `🧾 <b>${escapeHtml(info.tag)}</b>\n` +
                `К оплате: <b>${info.available.toLocaleString('ru-RU')} ₽</b>` +
                pendingLine +
                `\n\n` +
                (breakdownText ? `${breakdownText}\n\n` : '') +
                `Оплата онлайн картой или по СБП через Т-Банк.\n\n` +
                `Выберите готовый вариант ниже или напишите свою сумму числом ` +
                `(например, <code>1500</code> или <code>1500,50</code>).`,
            { reply_markup: keyboard, parse_mode: 'HTML' },
        );
    }

    private async handlePreset(ctx: CustomContext, userId: number, purchaseId: number, percent: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.available <= 0) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            return;
        }

        const amount = Math.round(info.available * (percent / 100) * 100) / 100;
        if (amount <= 0) {
            await ctx.answerCallbackQuery({ text: 'Слишком маленькая сумма', show_alert: true });
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startPromoStep(purchaseId, info.tag, info.available, amount);

        const pinned = buildPinnedPromo(
            await this.container.paymentService.findPinnedPromo(userId, purchaseId),
            amount,
        );
        await ctx.answerCallbackQuery();

        if (pinned) {
            await continueToCheckout(ctx, this.container, amount, pinned, { pinned: true });
            return;
        }

        const amountTitle = percent >= 100 ? 'Сумма' : `Сумма (${percent}% остатка)`;
        const breakdownText = formatBreakdown(info);
        await ctx.reply(
            `${amountTitle}: <b>${amount.toLocaleString('ru-RU')} ₽</b>\n\n` +
                (breakdownText ? `${breakdownText}\n\n` : '') +
                `Есть промокод? Введите его текстом, либо продолжите без него.\n\n` +
                `/cancel — отменить`,
            { reply_markup: this.promoKeyboard(), parse_mode: 'HTML' },
        );
    }

    private async handlePromo(ctx: CustomContext): Promise<void> {
        const flow = this.container.flowFor(ctx);
        const current = flow.current;

        // Кнопка «Ввести промокод» показывается, когда сумма уже выбрана (шаг promo).
        if (!current || flow.currentStep !== 'promo' || current.amount == null) {
            await ctx.answerCallbackQuery({ text: STALE_BUTTON_TEXT, show_alert: true });
            return;
        }

        flow.advanceToPromo(current.amount);
        flow.clearPromo();
        await ctx.answerCallbackQuery();
        await ctx.reply('Введите промокод текстом.\n\n' + 'Если промокода нет — нажмите «Продолжить без промокода».', {
            reply_markup: this.promoKeyboard(),
        });
    }

    private async handleSkip(ctx: CustomContext): Promise<void> {
        const flow = this.container.flowFor(ctx);
        const current = flow.current;

        // Старая кнопка из прошлой оплаты не должна перескакивать текущие шаги.
        if (!current || flow.currentStep !== 'promo' || current.amount == null) {
            await ctx.answerCallbackQuery({ text: STALE_BUTTON_TEXT, show_alert: true });
            return;
        }

        flow.clearPromo();
        await ctx.answerCallbackQuery();
        await continueToCheckout(ctx, this.container, current.amount);
    }

    private async handleMethod(ctx: CustomContext, userId: number, method: 'card' | 'sbp'): Promise<void> {
        const flow = this.container.flowFor(ctx);
        const current = flow.current;
        if (!current || flow.currentStep !== 'method' || current.amount == null) {
            await ctx.answerCallbackQuery({ text: STALE_BUTTON_TEXT, show_alert: true });
            return;
        }
        if (!(await this.container.paymentGuard.isOpenById(current.purchaseId))) {
            flow.clear();
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        await ctx.answerCallbackQuery({ text: 'Создаю ссылку на оплату…' });
        try {
            const created = await this.container.paymentService.createOnlinePayment({
                userId,
                purchaseId: current.purchaseId,
                amount: current.amount,
                method: method === 'sbp' ? 'TBANK_SBP' : 'TBANK_CARD',
                promoCode: current.promoCode?.code,
                receiptContact: current.receiptContact,
                // После оплаты банк вернёт клиента обратно в бота.
                returnUrl: ctx.me?.username ? `https://t.me/${ctx.me.username}?start=${PAID_START_PAYLOAD}` : undefined,
            });
            flow.clear();

            const total = created.total.toLocaleString('ru-RU');
            const feeLine =
                created.fee > 0
                    ? `\nВ том числе комиссия банка: ${created.fee.toLocaleString('ru-RU')} ₽`
                    : '\nБез комиссии';
            const keyboard = new InlineKeyboard().url(`Оплатить ${total} ₽`, created.paymentUrl);
            await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
            await ctx.reply(
                `🔗 Ссылка на оплату по закупке «${escapeHtml(current.purchaseTag)}» готова.\n` +
                    `Сумма: <b>${total} ₽</b>${feeLine}\n\n` +
                    (method === 'sbp'
                        ? 'Кнопка откроет выбор банка для оплаты по СБП.\n'
                        : 'Кнопка откроет защищённую страницу оплаты Т-Банка.\n') +
                    'Ссылка действует 30 минут. Как только оплата пройдёт, я пришлю подтверждение.',
                { parse_mode: 'HTML', reply_markup: keyboard },
            );
        } catch (err) {
            await ctx.reply(
                `${userErrorMessage(err, 'Не удалось создать ссылку на оплату.')}\n\nПопробуйте ещё раз: /pay`,
            );
        }
    }

    private promoKeyboard(): InlineKeyboard {
        return new InlineKeyboard().text('Продолжить без промокода', 'pay:skip');
    }
}
