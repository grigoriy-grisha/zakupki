import type { PrismaClient } from '@zakupki/database';
import type { Bot } from 'grammy';
import { TelegramChannelPostQueue, UnrecoverableError, type RedisClient } from '@zakupki/queue';

import type { CustomContext } from '../types';
import { buildProductPostText, getChannelIdFromEnv, sendChannelPost } from '../lib/telegram-post';

interface PurchaseChannelPostHandlerOptions {
    redis: RedisClient;
    db: PrismaClient;
}

export function setupPurchaseChannelPostHandler(
    bot: Bot<CustomContext>,
    { redis, db }: PurchaseChannelPostHandlerOptions,
) {
    const queue = new TelegramChannelPostQueue(redis);
    const channelId = getChannelIdFromEnv();

    if (!channelId) {
        console.warn('[TG queue] TG_CHANNEL_ID не задан — воркер публикации отключён');
        queue.setupWorker({
            handler: async () => {
                console.debug('[TG queue] Job skipped: channel not configured');
            },
        });
        return queue;
    }

    queue.setupWorker({
        handler: async (job) => {
            const { purchaseItemId } = job.data;

            const item = await db.purchaseItem.findUnique({
                where: { id: purchaseItemId },
                include: {
                    product: { include: { unit: true } },
                    purchase: { select: { tag: true } },
                },
            });

            if (!item?.product) {
                throw new UnrecoverableError(`PurchaseItem ${purchaseItemId} not found`);
            }

            const text = buildProductPostText(item.product, item.purchase.tag);
            const { messageId } = await sendChannelPost(bot.api, channelId, text);

            await db.purchaseItem.update({
                where: { id: purchaseItemId },
                data: {
                    tgMessageId: String(messageId),
                    tgChannelId: channelId,
                },
            });

            console.log(`[TG queue] Posted item ${purchaseItemId} → message ${messageId}`);
        },
        onFailed: (job, err) => {
            console.error(
                `[TG queue] Failed job ${job.id} (purchaseItemId=${job.data.purchaseItemId}): ${err.message}`,
            );
        },
    });

    console.log('[TG queue] Purchase channel post worker started');
    return queue;
}
