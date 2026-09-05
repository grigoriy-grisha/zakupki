import { createLogger } from '@zakupki/logger';

import type { ServiceContainer } from '../../container/service-container';
import type { MessageHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { reactOrderAccepted } from '../../lib/order-ack';
import { getChannelPostThreadId, isOrderCollectionMessage } from '../../lib/telegram-chat';
import { OrderCollectionService } from '../../services/order-collection.service';

const log = createLogger('order-reply');

export class OrderReplyHandler implements MessageHandler {
    readonly filter = 'order_reply' as const;
    readonly requireAuth = false;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, next: () => Promise<void>): Promise<void> {
        if (!ctx.message || !('text' in ctx.message) || !ctx.message.text) {
            await next();
            return;
        }
        if (!ctx.chat || !ctx.from || ctx.from.is_bot) {
            await next();
            return;
        }

        const replyTo = ctx.message.reply_to_message;
        const threadId = getChannelPostThreadId(ctx.message);

        if (!replyTo && threadId == null) {
            await next();
            return;
        }

        if (!isOrderCollectionMessage(ctx.chat.id, ctx.message)) {
            await next();
            return;
        }

        const service = OrderCollectionService.fromContainer(this.container);

        if (!/^[-+]?\d/.test(ctx.message.text.trim())) {
            const hint = await service.getQuantityHint({
                chatId: ctx.chat.id,
                replyTo,
                threadId,
            });
            if (hint) {
                await ctx.reply(hint, { reply_parameters: { message_id: ctx.message.message_id } });
            }
            return;
        }

        const result = await service.collectFromReply({
            chatId: ctx.chat.id,
            replyTo,
            threadId,
            text: ctx.message.text,
            telegramId: String(ctx.from.id),
            userInfo: {
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
                username: ctx.from.username,
            },
            messageId: ctx.message.message_id,
        });

        if (!result.ok) {
            if (result.reason === 'product_not_found') {
                log.debug(
                    { telegramId: ctx.from.id, chatId: ctx.chat.id, message: result.message },
                    'ignoring reply without purchase item',
                );
                return;
            }
            log.warn(
                { telegramId: ctx.from.id, chatId: ctx.chat.id, reason: result.reason, message: result.message },
                'order failed',
            );
            await ctx.reply(result.message, { reply_parameters: { message_id: ctx.message.message_id } });
            return;
        }

        log.info(
            {
                telegramId: ctx.from.id,
                product: result.productName,
                quantity: result.quantity,
                unit: result.unitShort,
            },
            'order saved',
        );

        await reactOrderAccepted(ctx);
    }
}
