import type { NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';

import type { ServiceContainer } from '../../container/service-container';
import type { MessageHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { continueToCheckout } from '../../lib/payment-checkout';
import { userErrorMessage } from '../../lib/user-error';
import { isPrivateChat } from '../shared/is-private-chat';

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
        if (text.startsWith('/')) {
            await next();
            return;
        }

        const amount = current.amount!;
        let promo;
        try {
            promo = await this.container.paymentService.validatePromoCode(text, current.purchaseId, amount);
        } catch (err) {
            const msg = userErrorMessage(err, 'Не удалось проверить промокод');
            const keyboard = new InlineKeyboard()
                .text('Ввести другой код', 'pay:promo')
                .text('Продолжить без промокода', 'pay:skip');
            await ctx.reply(`${msg}\n\nМожно попробовать другой код или продолжить без промокода.`, {
                reply_markup: keyboard,
            });
            return;
        }
        await continueToCheckout(ctx, this.container, amount, promo);
    }
}
