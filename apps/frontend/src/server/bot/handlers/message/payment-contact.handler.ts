import type { NextFunction } from 'grammy';

import { normalizeReceiptContact } from '@/server/services/online-payment.service';

import type { ServiceContainer } from '../../container/service-container';
import type { MessageHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { sendMethodChoice } from '../../lib/payment-checkout';
import { isPrivateChat } from '../shared/is-private-chat';

/** Шаг «контакт для чека»: email, куда онлайн-касса пришлёт чек. */
export class PaymentContactHandler implements MessageHandler {
    readonly filter = 'text_with_payment_flow' as const;
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, next: NextFunction): Promise<void> {
        const flow = this.container.flowFor(ctx);
        if (!flow.isActive || !isPrivateChat(ctx) || flow.currentStep !== 'contact') {
            await next();
            return;
        }

        const text = ctx.message?.text?.trim();
        if (!text || text.startsWith('/')) {
            await next();
            return;
        }

        const contact = normalizeReceiptContact(text);
        if (!contact) {
            await ctx.reply('Не похоже на email. Пример: mail@example.ru');
            return;
        }

        const current = flow.current!;
        flow.setReceiptContact(contact.email);
        await sendMethodChoice(ctx, this.container, current.amount!, current.promoCode);
    }
}
