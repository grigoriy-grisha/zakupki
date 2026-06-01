import type { Message } from 'grammy/types';

import type { CustomContext } from '../domain/types';
import { getLinkedDiscussionChatId } from '../lib/channel-discussion';
import {
    SHOP_COMMENT_TEXT,
    formatShopCommentError,
    markShopCommentPosted,
    shopCommentReplyOptions,
    wasShopCommentPosted,
} from '../lib/post-shop-comment';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import { chatIdsMatch } from '../lib/telegram-chat';
import { shopUrlKeyboard } from '../lib/webapp-url';

function isOurChannelAutomaticForward(message: Message, chatId: number): boolean {
    if (!message.is_automatic_forward) return false;

    const channelId = getChannelIdFromEnv();
    if (message.sender_chat?.type === 'channel' && channelId && chatIdsMatch(message.sender_chat.id, channelId)) {
        return true;
    }

    const origin = message.forward_origin;
    if (origin?.type === 'channel' && channelId && chatIdsMatch(origin.chat.id, channelId)) {
        return true;
    }

    // В привязанной группе обсуждений автопересылка — только с нашего канала.
    const discussionId = getLinkedDiscussionChatId();
    if (discussionId && chatIdsMatch(chatId, discussionId)) {
        return true;
    }

    return false;
}

/**
 * После публикации в канал Telegram пересылает пост в группу обсуждений.
 * Отвечаем reply на это сообщение — так кнопка всегда под постом, не раньше.
 */
export async function channelPostShopCommentHandler(ctx: CustomContext) {
    const message = ctx.message;
    if (!message || !ctx.chat) return;
    if (!message.is_automatic_forward) return;
    if (!isOurChannelAutomaticForward(message, ctx.chat.id)) return;

    const channelPostId =
        message.forward_origin?.type === 'channel'
            ? message.forward_origin.message_id
            : (message as { forward_from_message_id?: number }).forward_from_message_id;

    if (channelPostId == null) {
        console.warn('[TG] Автопересылка без id поста канала');
        return;
    }

    if (wasShopCommentPosted(channelPostId)) {
        return;
    }

    try {
        await ctx.reply(SHOP_COMMENT_TEXT, shopCommentReplyOptions(message.message_id));
        markShopCommentPosted(channelPostId);
        console.log(
            `[TG] Shop comment reply on discussion msg ${message.message_id} (channel post ${channelPostId})`,
        );
    } catch (err) {
        const replyMarkup = shopUrlKeyboard();
        if (replyMarkup) {
            try {
                await ctx.reply(SHOP_COMMENT_TEXT, {
                    reply_parameters: { message_id: message.message_id },
                });
                markShopCommentPosted(channelPostId);
                console.log(`[TG] Shop comment text-only reply under post ${channelPostId}`);
                return;
            } catch (retryErr) {
                console.error('[TG] Shop comment failed:', formatShopCommentError(retryErr));
                return;
            }
        }
        console.error('[TG] Shop comment failed:', formatShopCommentError(err));
    }
}
