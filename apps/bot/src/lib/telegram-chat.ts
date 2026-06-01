import { getLinkedDiscussionChatId } from './channel-discussion';
import { getChannelIdFromEnv, normalizeChatId } from './telegram-post';
import { collectTelegramPostRefs, type ReplyToMessage, walkReplyChain } from './resolve-reply-purchase-item';

export type OrderCollectionMessage = {
    reply_to_message?: ReplyToMessage;
    message_thread_id?: number;
};

export function getOrdersChatIdFromEnv(): string | null {
    const raw = (process.env.TG_ORDERS_CHAT_ID ?? process.env.TELEGRAM_ORDERS_CHAT_ID)?.trim();
    return raw ? normalizeChatId(raw) : null;
}

/** Ключ для сравнения: -1003537022316 и -3537022316 — один чат. */
function telegramChatIdKey(id: string | number): string {
    const s = normalizeChatId(String(id));
    if (s.startsWith('@')) return s;
    if (s.startsWith('-100')) return s.slice(4);
    if (s.startsWith('-')) return s.slice(1);
    return s;
}

export function chatIdsMatch(a: number | string, b: string): boolean {
    return telegramChatIdKey(a) === telegramChatIdKey(b);
}

function replyReferencesChannel(replyTo: ReplyToMessage, chatId: number, channelChatId: string): boolean {
    for (const msg of walkReplyChain(replyTo)) {
        for (const ref of collectTelegramPostRefs(chatId, msg)) {
            if (chatIdsMatch(ref.channelId, channelChatId)) return true;
        }
    }
    return false;
}

/** Orders chat, channel itself, or discussion group with forwards from our channel. */
export function isOrderCollectionChat(chatId: number, replyTo?: ReplyToMessage): boolean {
    const ordersChatId = getOrdersChatIdFromEnv();
    const channelChatId = getChannelIdFromEnv();

    if (ordersChatId && chatIdsMatch(chatId, ordersChatId)) return true;
    if (channelChatId && chatIdsMatch(chatId, channelChatId)) return true;
    if (replyTo && channelChatId && replyReferencesChannel(replyTo, chatId, channelChatId)) return true;

    return false;
}

export function isOrdersChat(chatId: number, ordersChatId: string | null): boolean {
    if (!ordersChatId) return false;
    return chatIdsMatch(chatId, ordersChatId);
}

export function isLinkedDiscussionChat(chatId: number): boolean {
    const discussionId = getLinkedDiscussionChatId();
    return discussionId != null && chatIdsMatch(chatId, discussionId);
}

/** id поста в канале = message_thread_id темы в группе обсуждений. */
export function getChannelPostThreadId(message: OrderCollectionMessage): number | undefined {
    return message.message_thread_id ?? message.reply_to_message?.message_thread_id;
}

/** Сообщение в чате заказов, канале или комментарии к посту. */
export function isOrderCollectionMessage(chatId: number, message: OrderCollectionMessage): boolean {
    if (isOrderCollectionChat(chatId, message.reply_to_message)) return true;

    if (isLinkedDiscussionChat(chatId)) {
        if (message.reply_to_message) return true;
        if (getChannelPostThreadId(message) != null) return true;
    }

    return false;
}
