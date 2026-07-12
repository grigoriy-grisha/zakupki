import type { CustomContext } from '../../domain/types';
import { isOrderCollectionMessage } from '../../lib/telegram-chat';
import type { MessageHandler } from '../../domain/handler';

/**
 * FallbackTextHandler — последний catch-all для message:text.
 *
 * Условия НЕ-ответа (пропускает событие, ничего не делая):
 *  - Активный payment flow → пусть PaymentAmountHandler обработает
 *  - Авто-форвард из канала → обработает ChannelPostShopCommentHandler
 *  - Сообщение в order collection chat → обработает OrderReplyHandler
 *
 * В остальных случаях отвечает «Используйте /start чтобы открыть приложение».
 */
export class FallbackTextHandler implements MessageHandler {
    readonly filter = 'fallback_text' as const;
    readonly requireAuth = false;

    async handle(ctx: CustomContext, _next: () => Promise<void>): Promise<void> {
        if (ctx.session.paymentFlow) return;
        if (ctx.message?.is_automatic_forward) return;
        if (ctx.chat && ctx.message && isOrderCollectionMessage(ctx.chat.id, ctx.message)) return;
        await ctx.reply('Используйте /start чтобы открыть приложение.');
    }
}
