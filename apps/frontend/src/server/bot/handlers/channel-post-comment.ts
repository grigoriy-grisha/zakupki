import type { Message } from 'grammy/types';
import { createLogger } from '@zakupki/logger';

import type { CustomContext } from '../domain/types';
import { isLinkedDiscussionChat } from '../lib/telegram-chat';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import { getDiscussionMessageStore } from '../lib/discussion-message-store';

const log = createLogger('channel-post-comment');

function getChannelPostIdFromForward(message: Message): number | null {
    if (message.forward_origin?.type === 'channel') {
        return message.forward_origin.message_id;
    }
    const legacy = (message as { forward_from_message_id?: number }).forward_from_message_id;
    return legacy ?? null;
}

/**
 * Handler `is_automatic_forward` в обсуждении канала. Единственная задача —
 * проиндексировать `channelPostMessageId → discussionMessageId` в Redis.
 * Shop-комментарий и статус-комментарии отправляет TgPostWorker (через
 * очередь tg-post-jobs).
 */
export async function channelPostShopCommentHandler(ctx: CustomContext) {
    if (!ctx.message || !ctx.chat) return;
    if (!ctx.message.is_automatic_forward) return;
    if (!isLinkedDiscussionChat(ctx.chat.id)) return;

    const channelPostId = getChannelPostIdFromForward(ctx.message);
    if (channelPostId == null) {
        log.warn({ messageId: ctx.message.message_id }, 'auto-forward without channel post id');
        return;
    }

    const channelId = getChannelIdFromEnv();
    if (!channelId) return;
    await getDiscussionMessageStore().set(channelId, channelPostId, ctx.message.message_id);
    log.debug({ channelPostId, discussionMessageId: ctx.message.message_id }, 'indexed');
}
