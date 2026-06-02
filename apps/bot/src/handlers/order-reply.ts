import type { CustomContext } from '../domain/types';
import { reactOrderAccepted } from '../lib/order-ack';
import { getChannelPostThreadId, isOrderCollectionMessage } from '../lib/telegram-chat';
import { OrderCollectionService } from '../services/order-collection.service';

export async function orderReplyHandler(ctx: CustomContext) {
    if (!ctx.message || !('text' in ctx.message) || !ctx.message.text) return;
    if (!ctx.chat || !ctx.from || ctx.from.is_bot) return;

    const replyTo = ctx.message.reply_to_message;
    const threadId = getChannelPostThreadId(ctx.message);

    if (!replyTo && threadId == null) return;

    if (!isOrderCollectionMessage(ctx.chat.id, ctx.message)) {
        return;
    }

    if (!/^[-+]?\d/.test(ctx.message.text.trim())) {
        await ctx.reply(
            'Напишите количество числом. Например:\n• 10 — добавить 10\n• +10 — добавить 10\n• -5 — убрать 5',
            { reply_parameters: { message_id: ctx.message.message_id } },
        );
        return;
    }

    const service = new OrderCollectionService();
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
    });

    if (!result.ok) {
        console.warn(
            `[order] Failed for user ${ctx.from.id} in chat ${ctx.chat.id}: ${result.reason} — ${result.message}`,
        );
        await ctx.reply(result.message, { reply_parameters: { message_id: ctx.message.message_id } });
        return;
    }

    console.log(
        `[order] Saved: user ${ctx.from.id}, ${result.productName}, total ${result.quantity} ${result.unitShort}`,
    );

    await reactOrderAccepted(ctx);
}
