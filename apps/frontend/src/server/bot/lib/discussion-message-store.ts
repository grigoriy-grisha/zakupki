import type { RedisClient } from '@zakupki/queue';
import { getRedisConnection } from '@zakupki/queue';

import { log } from './logger';

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней
const KEY_PREFIX = 'tg_post_to_discussion_msg';

/**
 * Маппинг `channelId:channelPostMessageId → discussionMessageId` в Redis.
 *
 * Заполняется в `channel-post-status-comment.handler.ts`, когда бот ловит
 * `is_automatic_forward` (форвард поста в обсуждение).
 *
 * Используется в `CommentPublisher.postStatus` для `reply_parameters`,
 * чтобы статус-комментарий прикреплялся прямо под форвардом конкретного поста.
 */
export class DiscussionMessageStore {
    constructor(private readonly redis: RedisClient = getRedisConnection()) {}

    static keyFor(channelId: string, channelPostMessageId: number | string): string {
        return `${KEY_PREFIX}:${channelId}:${channelPostMessageId}`;
    }

    async set(channelId: string, channelPostMessageId: number, discussionMessageId: number): Promise<void> {
        try {
            await this.redis.set(
                DiscussionMessageStore.keyFor(channelId, channelPostMessageId),
                String(discussionMessageId),
                'EX',
                TTL_SECONDS,
            );
        } catch (err) {
            log.warn({ err, channelId, channelPostMessageId }, 'DiscussionMessageStore set failed');
        }
    }

    async get(channelId: string, channelPostMessageId: number): Promise<number | null> {
        try {
            const raw = await this.redis.get(DiscussionMessageStore.keyFor(channelId, channelPostMessageId));
            if (!raw) return null;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
        } catch (err) {
            log.warn({ err, channelId, channelPostMessageId }, 'DiscussionMessageStore get failed');
            return null;
        }
    }

    /**
     * Ждёт, пока handler `is_automatic_forward` проиндексирует discussionMessageId.
     * Polling с интервалом 200ms до `timeoutMs`. Возвращает null если не дождались —
     * caller шлёт комментарий без replyToMessageId (fallback в общую ленту).
     */
    async waitFor(channelId: string, channelPostMessageId: number, timeoutMs = 5_000): Promise<number | null> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const id = await this.get(channelId, channelPostMessageId);
            if (id != null) return id;
            await new Promise((r) => setTimeout(r, 200));
        }
        return null;
    }
}

let _store: DiscussionMessageStore | null = null;

/** Backward-compat singleton — старые импорты продолжают работать. */
export function getDiscussionMessageStore(): DiscussionMessageStore {
    if (!_store) _store = new DiscussionMessageStore();
    return _store;
}
