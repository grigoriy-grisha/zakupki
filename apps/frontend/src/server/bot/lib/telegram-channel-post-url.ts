import { normalizeChatId } from './telegram-post';

/** Ссылка на пост в канале (публичный @username или приватный /c/…). */
export function buildTelegramChannelPostUrl(
    channelId: string | null | undefined,
    messageId: string | null | undefined,
): string | null {
    if (!channelId?.trim() || !messageId?.trim()) return null;

    const msgId = messageId.trim();
    if (!/^\d+$/.test(msgId)) return null;

    const chat = normalizeChatId(channelId.trim());
    if (chat.startsWith('@')) {
        return `https://t.me/${chat.slice(1)}/${msgId}`;
    }
    if (chat.startsWith('-100')) {
        return `https://t.me/c/${chat.slice(4)}/${msgId}`;
    }
    if (chat.startsWith('-')) {
        return `https://t.me/c/${chat.slice(1)}/${msgId}`;
    }
    if (/^\d+$/.test(chat)) {
        return `https://t.me/c/${chat}/${msgId}`;
    }

    return null;
}
