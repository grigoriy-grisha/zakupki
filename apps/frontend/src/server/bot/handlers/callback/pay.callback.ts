import { InlineKeyboard } from 'grammy';

import type { ServiceContainer } from '../../container/service-container';
import type { CallbackAction } from '../../domain/callback-data';
import type { CallbackHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import type { BotPurchasePaymentInfo } from '../../services/bot/bot-payment.service';

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
            await this.handleAll(ctx, userId, action.purchaseId);
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

        await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
    }

    private async handlePick(ctx: CustomContext, userId: number, purchaseId: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            await ctx.editMessageText('Эта закупка больше недоступна для оплаты. Нажмите /pay снова.');
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startAmountStep(purchaseId, info.tag, info.remaining);

        const keyboard = new InlineKeyboard().text(
            `Оплатить всё (${info.remaining.toLocaleString('ru-RU')} ₽)`,
            `pay:all:${purchaseId}`,
        );

        await ctx.answerCallbackQuery();
        const breakdownText = formatBreakdown(info);
        await ctx.editMessageText(
            `Закупка «${info.tag}»\n` +
                `К оплате: ${info.remaining.toLocaleString('ru-RU')} ₽\n\n` +
                (breakdownText ? `${breakdownText}\n\n` : '') +
                `Введите сумму в рублях или нажмите кнопку ниже.`,
            { reply_markup: keyboard },
        );
    }

    private async handleAll(ctx: CustomContext, userId: number, purchaseId: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startPromoStep(purchaseId, info.tag, info.remaining, info.remaining);

        await ctx.answerCallbackQuery();
        const breakdownText = formatBreakdown(info);
        await ctx.reply(
            `Сумма: ${info.remaining.toLocaleString('ru-RU')} ₽\n\n` +
                (breakdownText ? `${breakdownText}\n\n` : '') +
                `Есть промокод? Введите его текстом, либо продолжите без него.\n\n` +
                `/cancel — отменить`,
            { reply_markup: this.promoKeyboard() },
        );
    }

    /** `pay:promo` — переход amount → promo, запрос кода текстом. */
    private async handlePromo(ctx: CustomContext): Promise<void> {
        const flow = this.container.flowFor(ctx);
        const current = flow.current;

        if (!current || flow.currentStep !== 'amount' || current.amount == null) {
            await ctx.answerCallbackQuery({ text: 'Сначала укажите сумму', show_alert: true });
            return;
        }

        flow.advanceToPromo(current.amount);
        await ctx.answerCallbackQuery();
        await ctx.reply(
            'Введите промокод текстом.\n\n' + 'Если промокода нет — нажмите «Продолжить без промокода».',
            { reply_markup: this.promoKeyboard() },
        );
    }

    /** `pay:skip` — продолжить без промокода (promo/amount → proof). */
    private async handleSkip(ctx: CustomContext): Promise<void> {
        const flow = this.container.flowFor(ctx);
        const current = flow.current;

        if (!current || current.amount == null) {
            await ctx.answerCallbackQuery({ text: 'Сначала укажите сумму', show_alert: true });
            return;
        }

        flow.advanceToProof();
        await ctx.answerCallbackQuery();
        await ctx.reply(
            `Сумма: ${current.amount.toLocaleString('ru-RU')} ₽\n\n` +
                `Пришлите фото или PDF чека об оплате.\n` +
                `Комментарий можно добавить в подписи к файлу.\n\n` +
                `/cancel — отменить`,
        );
    }

    private promoKeyboard(): InlineKeyboard {
        return new InlineKeyboard().text('Продолжить без промокода', 'pay:skip');
    }
}
