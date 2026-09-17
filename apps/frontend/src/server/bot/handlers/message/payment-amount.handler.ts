import type { NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';

import type { ServiceContainer } from '../../container/service-container';
import type { MessageHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { proofStepText } from '../../lib/payment-texts';
import { buildPinnedPromo } from '../../lib/pinned-promo';
import { PAYMENT_NOT_OPEN_MESSAGE } from '../../lib/purchase-payment-guard';
import { isPrivateChat } from '../shared/is-private-chat';
import { parseCurrencyAmount } from '../shared/parse-currency-amount';

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
        if (amount > current.available) {
            await ctx.reply(`Максимум ${current.available.toLocaleString('ru-RU')} ₽`);
            return;
        }
        if (!(await this.container.paymentGuard.isOpenById(current.purchaseId))) {
            flow.clear();
            await ctx.reply(PAYMENT_NOT_OPEN_MESSAGE);
            return;
        }

        const pinnedPromo = await this.container.paymentService.findPinnedPromo(
            ctx.session.userId!,
            current.purchaseId,
        );
        const pinned = buildPinnedPromo(pinnedPromo, amount);
        if (pinned) {
            flow.advanceToProof(pinned);
            await ctx.reply(proofStepText(amount, pinned, { pinned: true }), { parse_mode: 'HTML' });
            return;
        }

        flow.advanceToPromo(amount);

        const keyboard = new InlineKeyboard()
            .text('✂️ Ввести промокод', 'pay:promo')
            .text('Продолжить »', 'pay:skip');

        await ctx.reply(
            `Сумма: <b>${amount.toLocaleString('ru-RU')} ₽</b>\n\n` +
                `Есть промокод? Введите его текстом или выберите вариант ниже.`,
            { reply_markup: keyboard, parse_mode: 'HTML' },
        );
    }
}
