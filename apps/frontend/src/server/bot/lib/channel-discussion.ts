import type { Api } from 'grammy';

import { getChannelIdFromEnv, normalizeChatId } from './telegram-post';

let linkedDiscussionChatId: string | null = null;
let initialized = false;

export async function initChannelDiscussion(api: Api): Promise<void> {
    const channelId = getChannelIdFromEnv();
    if (!channelId) {
        linkedDiscussionChatId = null;
        initialized = true;
        return;
    }

    try {
        const chat = await api.getChat(channelId);
        const rawLinked =
            chat.type === 'channel' ? ((chat as { linked_chat_id?: number }).linked_chat_id ?? null) : null;
        linkedDiscussionChatId = rawLinked != null ? normalizeChatId(String(rawLinked)) : null;
        console.log(`[bot] Channel discussion chat: ${linkedDiscussionChatId ?? 'not linked'}`);
    } catch (err) {
        console.warn('[bot] Could not load channel discussion chat:', err);
        linkedDiscussionChatId = null;
    }

    initialized = true;
}

export function getLinkedDiscussionChatId(): string | null {
    return linkedDiscussionChatId;
}

export function isChannelDiscussionReady(): boolean {
    return initialized;
}
