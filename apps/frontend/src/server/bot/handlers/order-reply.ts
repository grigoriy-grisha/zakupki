import type { CustomContext } from '../domain/types';
import { getChannelPostThreadId, isOrderCollectionMessage } from '../lib/telegram-chat';
import { OrderCollectionService } from '../services/order-collection.service';
import { formatOrderReply } from '../lib/format-order-reply';
import { reactOrderAccepted } from '../lib/order-ack';
import { log } from '../lib/logger';
import { serviceContainer } from '@/server/lib/service-container';

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
            'Напишите количество числом. Например:\n• 10 — добавить 10\n• +10 — добавить 10\n• +2п — добавить 2 пачки\n• -5 — убрать 5\n• -1п — убрать пачку',
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
        messageId: ctx.message.message_id,
    });

    if (!result.ok) {
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

    // Получаем packDiscountPercent для форматирования
    let packDiscountPercent = 0;
    try {
        packDiscountPercent = await serviceContainer.pricingSettings.getBeadPackPriceDiscountPercent();
    } catch {
        // fallback — без скидки
    }

    const replyText = formatOrderReply(result, packDiscountPercent);

    await reactOrderAccepted(ctx);

    try {
        await ctx.reply(replyText, {
            reply_parameters: { message_id: ctx.message.message_id },
            parse_mode: 'HTML',
        });
    } catch {
        // Fallback без HTML
        await ctx.reply(replyText.replace(/<[^>]+>/g, ''), {
            reply_parameters: { message_id: ctx.message.message_id },
        });
    }
}
