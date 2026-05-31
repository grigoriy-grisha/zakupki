import type { CustomContext } from '../domain/types';
import { reactOrderAccepted } from '../lib/order-ack';
import { getChannelPostThreadId, isOrderCollectionMessage } from '../lib/telegram-chat';
import { OrderCollectionService } from '../services/order-collection.service';

export async function orderReplyHandler(ctx: CustomContext) {
    const message = ctx.message;
    if (!message || !('text' in message) || !message.text) return;
    if (!ctx.chat || !ctx.from || ctx.from.is_bot) return;

    // Fast regex pre-filter: skip non-order messages immediately without DB lookup
    if (!/^[-+]?\d/.test(message.text.trim())) return;

    const replyTo = message.reply_to_message;
    const threadId = getChannelPostThreadId(message);

    if (!replyTo && threadId == null) return;

    if (!isOrderCollectionMessage(ctx.chat.id, message)) {
        return;
    }

    const service = new OrderCollectionService();
    const result = await service.collectFromReply({
        chatId: ctx.chat.id,
        replyTo,
        threadId,
        text: message.text,
        telegramId: String(ctx.from.id),
        userInfo: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
        },
    });

    if (!result.ok) {
        console.warn(
            `[order] Failed for user ${ctx.from.id} in chat ${ctx.chat.id}: ${result.reason} — ${result.message}`,
        );
        await ctx.reply(result.message, { reply_parameters: { message_id: message.message_id } });
        return;
    }

    console.log(
        `[order] Saved: user ${ctx.from.id}, ${result.productName}, total ${result.quantity} ${result.unitShort}`,
    );

    await reactOrderAccepted(ctx);
}
