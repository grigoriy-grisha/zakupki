import type { NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';

import type { CustomContext } from '../../domain/types';
import { isPrivateChat } from '../shared/is-private-chat';
import type { MessageHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';

/**
 * PaymentPromoHandler — обрабатывает текстовый ввод промокода в payment flow.
 *
 * Активен только на шаге `promo` (между `amount` и `proof`). На любых других
 * шагах вызывает `next()`, чтобы не перехватывать чужие сообщения. Команды
 * (начинаются с `/`) тоже пропускает — их обрабатывает command-pipeline
 * (например, `/cancel`).
 *
 * На невалидный код отвечает сообщением об ошибке и предлагает повторить
 * или пропустить шаг — `next()` здесь НЕ вызывается, иначе FallbackTextHandler
 * промолчит (он подавлен при активном flow) и пользователь не получит ответа.
 */
export class PaymentPromoHandler implements MessageHandler {
    readonly filter = 'text_with_payment_flow' as const;
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, next: NextFunction): Promise<void> {
        const flow = this.container.flowFor(ctx);

        if (!flow.isActive || !isPrivateChat(ctx)) {
            await next();
            return;
        }

        if (flow.currentStep !== 'promo') {
            await next();
            return;
        }

        const current = flow.current!;
        const text = ctx.message?.text?.trim();
        if (!text) {
            await next();
            return;
        }
        // Commands (/cancel, /pay, ...) are handled by the command pipeline.
        if (text.startsWith('/')) {
            await next();
            return;
        }

        const amount = current.amount!;
        try {
            const promo = await this.container.paymentService.validatePromoCode(text, current.purchaseId, amount);
            flow.advanceToProof(promo);

            await ctx.reply(
                `Промокод ${promo.code} применён.\n` +
                    `Скидка: ${promo.discount.toLocaleString('ru-RU')} ₽\n` +
                    `К оплате: ${promo.finalAmount.toLocaleString('ru-RU')} ₽\n\n` +
                    `Пришлите фото или PDF чека об оплате.\n` +
                    `Комментарий можно добавить в подписи к файлу.\n\n` +
                    `/cancel — отменить`,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Промокод недействителен';
            const keyboard = new InlineKeyboard()
                .text('Ввести другой код', 'pay:promo')
                .text('Продолжить без промокода', 'pay:skip');
            await ctx.reply(`${msg}\n\nМожно попробовать другой код или продолжить без промокода.`, {
                reply_markup: keyboard,
            });
        }
    }
}
