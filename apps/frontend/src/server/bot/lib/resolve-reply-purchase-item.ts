import { normalizeChatId } from './telegram-post';

export interface ReplyToMessage {
    message_id: number;
    message_thread_id?: number;
    forward_origin?: {
        type: string;
        chat?: { id: number };
        message_id?: number;
    };
    forward_from_chat?: { id: number };
    forward_from_message_id?: number;
    sender_chat?: { id: number; type?: string };
    reply_to_message?: ReplyToMessage;
}

export interface TelegramPostRef {
    channelId: string;
    messageId: string;
}

export function* walkReplyChain(replyTo: ReplyToMessage | undefined): Generator<ReplyToMessage> {
    let current: ReplyToMessage | undefined = replyTo;
    let depth = 0;
    while (current && depth < 5) {
        yield current;
        current = current.reply_to_message;
        depth += 1;
    }
}

/** Collects possible (channelId, messageId) pairs from a replied-to message. */
export function collectTelegramPostRefs(chatId: number, replyTo: ReplyToMessage): TelegramPostRef[] {
    const refs: TelegramPostRef[] = [];
    const seen = new Set<string>();

    const add = (channelId: string, messageId: string) => {
        if (!messageId) return;
        const key = `${normalizeChatId(channelId)}:${messageId}`;
        if (seen.has(key)) return;
        seen.add(key);
        refs.push({ channelId: normalizeChatId(channelId), messageId });
    };

    add(String(chatId), String(replyTo.message_id));

    const origin = replyTo.forward_origin;
    if (origin?.type === 'channel' && origin.chat?.id != null && origin.message_id != null) {
        add(String(origin.chat.id), String(origin.message_id));
    }

    if (replyTo.forward_from_chat && replyTo.forward_from_message_id) {
        add(String(replyTo.forward_from_chat.id), String(replyTo.forward_from_message_id));
    }

    if (replyTo.sender_chat?.type === 'channel') {
        const channelMsgId = replyTo.forward_from_message_id ?? origin?.message_id;
        if (channelMsgId != null) {
            add(String(replyTo.sender_chat.id), String(channelMsgId));
        }
    }

    return refs;
}

export function allTelegramPostRefs(chatId: number, replyTo: ReplyToMessage): TelegramPostRef[] {
    const refs: TelegramPostRef[] = [];
    const seen = new Set<string>();

    for (const msg of walkReplyChain(replyTo)) {
        for (const ref of collectTelegramPostRefs(chatId, msg)) {
            const key = `${ref.channelId}:${ref.messageId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            refs.push(ref);
        }
        seen.add(String(msg.message_id));
    }

    return refs;
}
