import { dbClient } from '@zakupki/database';
import type { RedisClient } from '@zakupki/queue';
import { getRedisConnection } from '@zakupki/queue';

import { log } from '../lib/logger';
import { allTelegramPostRefs, type ReplyToMessage, walkReplyChain } from '../lib/resolve-reply-purchase-item';
import { getChannelIdFromEnv } from '../lib/telegram-post';

/** Ключ-кандидат для поиска PurchaseItem по Telegram-контексту. */
interface LookupCandidate {
    /** Redis-ключ для кеша. */
    cacheKey: string;
    /** ID канала — если есть, ищем по (tgChannelId + tgMessageId); если нет — только по tgMessageId. */
    channelId: string | null;
    /** ID сообщения в Telegram. */
    messageId: string;
}

const CACHE_TTL = 86400; // 24 ч

const ITEM_INCLUDE = {
    product: {
        select: {
            id: true,
            name: true,
            unitCode: true,
            multiplicity: true,
            photos: { orderBy: { sortOrder: 'asc' }, take: 1, select: { id: true, objectKey: true, mimeType: true } },
        },
    },
    supplier: { select: { id: true, name: true } },
    orderLines: { select: { quantity: true } },
    purchase: {
        select: {
            id: true,
            tag: true,
            status: true,
            fulfillmentStatus: true,
            deliveryPercent: true,
            deletedAt: true,
            currencyRates: { select: { currencyId: true, rateToRub: true } },
        },
    },
} as const;

// Prisma по умолчанию возвращает все scalar-поля (supplierLimit, supplierLimitUnit и др.)
// наряду с relations из ITEM_INCLUDE — отдельный select не требуется.

/**
 * Разрешает PurchaseItem по контексту Telegram-сообщения.
 *
 * Стратегии (по приоритету):
 * 1. Post refs — прямые ссылки на пост канала из пересылок
 * 2. Reply chain — walk по цепочке ответов
 * 3. Thread ID — thread_id в обсуждении = message_id поста в канале
 *
 * Для каждой стратегии: Redis cache → DB → cache write.
 */
export class PurchaseItemResolver {
    private redis: RedisClient;

    constructor(redis?: RedisClient) {
        this.redis = redis ?? getRedisConnection();
    }

    async resolvePurchaseItem(
        chatId: number,
        message: { reply_to_message?: ReplyToMessage; message_thread_id?: number },
    ) {
        const candidates = this.collectCandidates(chatId, message);

        for (const candidate of candidates) {
            const item = await this.tryResolve(candidate);
            if (item) return item;
        }

        return null;
    }

    // ── Private ─────────────────────────────────────────────

    /** Одна попытка: cache → DB, с кросс-кешированием post-key. */
    private async tryResolve(candidate: LookupCandidate) {
        const cachedId = await this.cacheGet(candidate.cacheKey);
        if (cachedId) {
            const item = await dbClient.purchaseItem.findUnique({
                where: { id: cachedId },
                include: ITEM_INCLUDE,
            });
            // Hidden items are excluded from ordering — treat as not found.
            if (item && !item.hidden) return item;
        }

        const item = await dbClient.purchaseItem.findFirst({
            where: {
                tgMessageId: candidate.messageId,
                ...(candidate.channelId ? { tgChannelId: candidate.channelId } : {}),
                publicationState: 'PUBLISHED',
                hidden: false,
            },
            include: ITEM_INCLUDE,
        });
        if (!item) return null;

        // Warm cache: текущий ключ + post-key (для будущих поисков через пересылки)
        const keys = [candidate.cacheKey];
        if (item.tgChannelId && item.tgMessageId) {
            keys.push(`tg_post_to_item:${item.tgChannelId}:${item.tgMessageId}`);
        }
        await this.cacheSet(keys, item.id);

        return item;
    }

    /** Собирает всех кандидатов для поиска, в порядке приоритета. */
    private collectCandidates(
        chatId: number,
        message: { reply_to_message?: ReplyToMessage; message_thread_id?: number },
    ): LookupCandidate[] {
        const candidates: LookupCandidate[] = [];

        if (message.reply_to_message) {
            // 1. Post refs — прямые ссылки на пост канала из пересылок
            for (const ref of allTelegramPostRefs(chatId, message.reply_to_message)) {
                candidates.push({
                    cacheKey: `tg_post_to_item:${ref.channelId}:${ref.messageId}`,
                    channelId: ref.channelId,
                    messageId: ref.messageId,
                });
            }

            // 2. Reply chain — walk по цепочке ответов
            for (const msg of walkReplyChain(message.reply_to_message)) {
                candidates.push({
                    cacheKey: `tg_msg_to_item:${chatId}:${msg.message_id}`,
                    channelId: null,
                    messageId: String(msg.message_id),
                });
            }
        }

        // 3. Thread ID — thread_id в обсуждении = message_id поста в канале
        const channelId = getChannelIdFromEnv();
        const threadId = message.message_thread_id ?? message.reply_to_message?.message_thread_id;
        if (channelId && threadId != null) {
            candidates.push({
                cacheKey: `tg_post_to_item:${channelId}:${threadId}`,
                channelId,
                messageId: String(threadId),
            });
        }

        return candidates;
    }

    // ── Cache ───────────────────────────────────────────────

    private async cacheGet(key: string): Promise<number | null> {
        try {
            const val = await this.redis.get(key);
            return val ? Number(val) : null;
        } catch {
            return null;
        }
    }

    private async cacheSet(keys: string[], id: number): Promise<void> {
        try {
            if (keys.length === 0) return;
            const pipeline = this.redis.pipeline();
            for (const key of keys) pipeline.set(key, String(id), 'EX', CACHE_TTL);
            await pipeline.exec();
        } catch (err) {
            log.error({ err, keys }, 'Redis cache set failed');
        }
    }
}
