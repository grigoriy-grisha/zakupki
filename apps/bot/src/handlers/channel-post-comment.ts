import type { Message } from 'grammy/types';

import type { CustomContext } from '../domain/types';
import { miniAppKeyboard } from '../lib/mini-app';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import { chatIdsMatch } from '../lib/telegram-chat';

function isOurChannelAutomaticForward(message: Message): boolean {
    const channelId = getChannelIdFromEnv();
    if (!channelId || !message.is_automatic_forward) return false;

    if (message.sender_chat?.type === 'channel' && chatIdsMatch(message.sender_chat.id, channelId)) {
        return true;
    }

    const origin = message.forward_origin;
    if (origin?.type === 'channel' && chatIdsMatch(origin.chat.id, channelId)) {
        return true;
    }

    return false;
}

/** Комментарий под новым постом канала — тот же приём, что в order-reply: ctx.reply + url-кнопка. */
export async function channelPostShopCommentHandler(ctx: CustomContext) {
    const message = ctx.message;
    if (!message || !ctx.chat) return;
    if (message.from?.is_bot) return;
    if (!isOurChannelAutomaticForward(message)) return;

    const replyMarkup = miniAppKeyboard();
    if (!replyMarkup) {
        console.warn('[TG] TELEGRAM_MINI_APP_URL не задан — комментарий под постом пропущен');
        return;
    }

    await ctx.reply('👇 Оформить заказ в магазине:', {
        reply_parameters: { message_id: message.message_id },
        reply_markup: replyMarkup,
    });

    const channelPostId =
        message.forward_origin?.type === 'channel'
            ? message.forward_origin.message_id
            : message.forward_from_message_id;

    console.log(
        `[TG] Shop comment under channel post${channelPostId != null ? ` ${channelPostId}` : ''} ` +
            `(discussion msg ${message.message_id})`,
    );
}
