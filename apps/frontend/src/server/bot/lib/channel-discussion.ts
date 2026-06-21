import type { Api } from 'grammy';
import { createLogger } from '@zakupki/logger';

import { getChannelIdFromEnv, normalizeChatId } from './telegram-post';

const log = createLogger('channel-discussion');

/**
 * Обёртка над linked-чатом обсуждений канала.
 *
 * Два режима использования:
 *  1. Через ServiceContainer (DI) — рекомендуемый путь после рефакторинга.
 *  2. Через module-level singleton (legacy) — для кода, который ещё не мигрировал.
 *     Все module-level helpers ниже (`initChannelDiscussion` и пр.) используют
 *     общий singleton-инстанс, привязанный к каналу из env.
 */
export class ChannelDiscussion {
    private linkedDiscussionChatId: string | null = null;
    private initialized = false;

    constructor(private readonly channelId: string | null) {}

    /** Eager init — вызывается из ServiceContainer.init() ДО старта воркера. */
    async init(api: Api): Promise<void> {
        await this.getOrInit(api);
        this.initialized = true;
    }

    /**
     * Lazy init: возвращает id группы обсуждений канала. Первый вызов получает
     * linked_chat_id через `getChat` (Telegram API) и кэширует.
     */
    async getOrInit(api: Api): Promise<string | null> {
        if (this.linkedDiscussionChatId !== null) return this.linkedDiscussionChatId;

        if (!this.channelId) return null;

        try {
            const chat = await api.getChat(this.channelId);
            const rawLinked =
                chat.type === 'channel' ? ((chat as { linked_chat_id?: number }).linked_chat_id ?? null) : null;
            this.linkedDiscussionChatId = rawLinked != null ? normalizeChatId(String(rawLinked)) : null;
            log.info({ discussionChatId: this.linkedDiscussionChatId }, 'channel discussion resolved');
        } catch (err) {
            log.error({ err }, 'failed to load channel discussion');
        }
        return this.linkedDiscussionChatId;
    }

    /** Synchronous getter — работает только после `init()`. */
    getLinkedChatId(): string | null {
        return this.linkedDiscussionChatId;
    }

    isReady(): boolean {
        return this.initialized;
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Legacy module-level API — backward compat для кода, не переведённого на DI.
// Все эти функции оперируют общим singleton-инстансом.
// ──────────────────────────────────────────────────────────────────────────

let _singleton: ChannelDiscussion | null = null;

function singleton(): ChannelDiscussion {
    if (!_singleton) {
        _singleton = new ChannelDiscussion(getChannelIdFromEnv());
    }
    return _singleton;
}

/**
 * Eager init: вызывается из bot/start.ts ДО старта воркера, чтобы первый же
 * job не словил `linkedDiscussionChatId === null`.
 */
export async function initChannelDiscussion(api: Api): Promise<void> {
    await singleton().init(api);
}

/**
 * Lazy init: возвращает id группы обсуждений канала. Первый вызов получает
 * linked_chat_id через `getChat` (Telegram API) и кэширует.
 */
export async function getOrInitDiscussionChatId(api: Api): Promise<string | null> {
    return singleton().getOrInit(api);
}

/** Synchronous getter — работает только после `initChannelDiscussion()`. */
export function getLinkedDiscussionChatId(): string | null {
    return singleton().getLinkedChatId();
}

export function isChannelDiscussionReady(): boolean {
    return singleton().isReady();
}
