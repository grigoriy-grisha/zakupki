import type { Api } from 'grammy';
import { createLogger } from '@zakupki/logger';

import { getChannelIdFromEnv, normalizeChatId } from './telegram-post';

const log = createLogger('channel-discussion');

let linkedDiscussionChatId: string | null = null;
let initialized = false;

/**
 * Eager init: вызывается из bot/start.ts ДО старта воркера, чтобы первый же
 * job не словил `linkedDiscussionChatId === null`.
 */
export async function initChannelDiscussion(api: Api): Promise<void> {
    await getOrInitDiscussionChatId(api);
    initialized = true;
}

/**
 * Lazy init: возвращает id группы обсуждений канала. Первый вызов получает
 * linked_chat_id через `getChat` (Telegram API) и кэширует.
 */
export async function getOrInitDiscussionChatId(api: Api): Promise<string | null> {
    if (linkedDiscussionChatId !== null) return linkedDiscussionChatId;

    const channelId = getChannelIdFromEnv();
    if (!channelId) return null;

    try {
        const chat = await api.getChat(channelId);
        const rawLinked =
            chat.type === 'channel' ? ((chat as { linked_chat_id?: number }).linked_chat_id ?? null) : null;
        linkedDiscussionChatId = rawLinked != null ? normalizeChatId(String(rawLinked)) : null;
        log.info({ discussionChatId: linkedDiscussionChatId }, 'channel discussion resolved');
    } catch (err) {
        log.error({ err }, 'failed to load channel discussion');
    }
    return linkedDiscussionChatId;
}

/** Synchronous getter — работает только после `initChannelDiscussion()`. */
export function getLinkedDiscussionChatId(): string | null {
    return linkedDiscussionChatId;
}

export function isChannelDiscussionReady(): boolean {
    return initialized;
}
