import type { PrismaClient } from '@zakupki/database';
import type { Bot } from 'grammy';
import { GrammyError } from 'grammy';
import { TelegramChannelPostQueue, UnrecoverableError, type RedisClient } from '@zakupki/queue';

import type { CustomContext } from '../lib/types';
import {
    buildProductPostText,
    getChannelIdFromEnv,
    productPhotoToAttachment,
    sendChannelPost,
} from '../lib/telegram-post';

export function setupPurchaseChannelPostHandler(
    bot: Bot<CustomContext>,
    { redis, db }: { redis: RedisClient; db: PrismaClient },
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
            const isEdit = (job.data as any).type === 'PURCHASE_ITEM_CHANNEL_POST_EDIT';

            const item = await db.purchaseItem.findUnique({
                where: { id: purchaseItemId },
                include: {
                    product: {
                        include: {
                            unit: true,
                            photos: {
                                orderBy: { sortOrder: 'asc' },
                                take: 1,
                                select: { data: true, mimeType: true },
                            },
                        },
                    },
                    purchase: { select: { tag: true } },
                },
            });

            if (!item?.product) {
                throw new UnrecoverableError(`PurchaseItem ${purchaseItemId} not found`);
            }

            const firstPhoto = item.product.photos[0];
            const photo =
                firstPhoto && firstPhoto.data.byteLength > 0
                    ? productPhotoToAttachment(firstPhoto)
                    : undefined;

            const text = buildProductPostText(item.product, item.purchase.tag);

            // Edit existing post
            if (isEdit && item.tgMessageId && item.tgChannelId) {
                const chatId = item.tgChannelId;
                const msgId = Number(item.tgMessageId);
                try {
                    if (photo) {
                        await bot.api.editMessageCaption(chatId, msgId, {
                            caption: text.slice(0, 1024),
                            parse_mode: 'HTML',
                        });
                    } else {
                        await bot.api.editMessageText(chatId, msgId, text.slice(0, 4096), {
                            parse_mode: 'HTML',
                        });
                    }
                    console.log(`[TG queue] Edited item ${purchaseItemId} → message ${msgId}`);
                } catch (err) {
                    if (err instanceof GrammyError && err.description.includes("message is not modified")) {
                        console.log(`[TG queue] Item ${purchaseItemId} — no changes, skipped`);
                    } else {
                        console.error(`[TG queue] Edit failed for item ${purchaseItemId}:`, err);
                        throw err;
                    }
                }
                return;
            }

            // Create new post
            console.log(`[TG queue] Item ${purchaseItemId}: photo=${!!photo}, text length=${text.length}`);

            let messageId: number;
            try {
                ({ messageId } = await sendChannelPost(bot.api, channelId, text, photo));
            } catch (err) {
                console.error(`[TG queue] sendChannelPost failed for item ${purchaseItemId}:`, err);
                throw err;
            }

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
