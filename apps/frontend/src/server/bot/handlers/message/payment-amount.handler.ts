import type { NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';

import type { CustomContext } from '../../domain/types';
import { isPrivateChat } from '../shared/is-private-chat';
import { parseCurrencyAmount } from '../shared/parse-currency-amount';
import type { MessageHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';
import { PAYMENT_NOT_OPEN_MESSAGE } from '../../lib/purchase-payment-guard';

/**
 * PaymentAmountHandler — обрабатывает текстовый ввод суммы в payment flow.
 *
 * На других шагах (promo/proof) вызывает `next()`, передавая управление
 * дальше по цепочке (PaymentPromoHandler / FallbackTextHandler).
 */
export class PaymentAmountHandler implements MessageHandler {
    readonly filter = 'text_with_payment_flow' as const;
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, next: NextFunction): Promise<void> {
        const flow = this.container.flowFor(ctx);

        if (!flow.isActive || !isPrivateChat(ctx)) {
            await next();
            return;
        }

        if (flow.currentStep === 'proof') {
            const text = ctx.message?.text?.trim();
            if (text && !text.startsWith('/')) {
                await ctx.reply('Пришлите фото или PDF чека. Комментарий укажите в подписи к файлу.');
            }
            return;
        }

        if (flow.currentStep !== 'amount') {
            await next();
            return;
        }

        const current = flow.current!;
        const text = ctx.message?.text?.trim();
        if (!text) {
            await next();
            return;
        }
        if (text.startsWith('/')) {
            await next();
            return;
        }

        const amount = parseCurrencyAmount(text);
        if (amount === null || amount <= 0) {
            await ctx.reply('Введите корректную сумму, например: 1500');
            return;
        }
        if (amount > current.remaining) {
            await ctx.reply(`Максимум ${current.remaining.toLocaleString('ru-RU')} ₽`);
            return;
        }
        if (!(await this.container.paymentGuard.isOpenById(current.purchaseId))) {
            flow.clear();
            await ctx.reply(PAYMENT_NOT_OPEN_MESSAGE);
            return;
        }

        // amount → promo: offer promo code entry before requesting the receipt.
        flow.advanceToPromo(amount);

        const keyboard = new InlineKeyboard()
            .text('✂️ Ввести промокод', 'pay:promo')
            .text('Продолжить »', 'pay:skip');

        await ctx.reply(
            `Сумма: ${amount.toLocaleString('ru-RU')} ₽\n\n` +
                `Есть промокод? Введите его текстом или выберите вариант ниже.`,
            { reply_markup: keyboard },
        );
    }
}
