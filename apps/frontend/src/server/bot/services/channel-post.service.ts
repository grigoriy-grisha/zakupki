import type { Api } from 'grammy';
import { GrammyError } from 'grammy';
import type { RedisClient } from '@zakupki/queue';
import { getRedisConnection, TelegramChannelPostQueue, UnrecoverableError } from '@zakupki/queue';
import { loadProductPhoto } from '@zakupki/storage';
import { dbClient } from '@zakupki/database';

import { TELEGRAM_CAPTION_MAX, TELEGRAM_MESSAGE_MAX } from '../domain/constants';
import type { ChannelPostPhoto } from '../domain/types';

import { postShopCommentInDiscussionWithRetry, waitUntilShopCommentPosted } from '../lib/post-shop-comment';
import {
    buildProductPostText,
    getChannelIdFromEnv,
    productPhotoToAttachment,
    sendChannelPost,
} from '../lib/telegram-post';
import { UserOrdersRejectService } from './user-orders-reject.service';

export class ChannelPostService {
    private channelId = getChannelIdFromEnv();

    constructor(private api: Api) {}

    setupWorker(redis: RedisClient): TelegramChannelPostQueue {
        const queue = new TelegramChannelPostQueue(redis);

        if (!this.channelId) {
            console.warn('[TG queue] TG_CHANNEL_ID not set — publish worker disabled');
            queue.setupWorker({
                handler: async () => {
                    console.debug('[TG queue] Job skipped: channel not configured');
                },
            });
            return queue;
        }

        queue.setupWorker({
            handler: async (job) => {
                if (job.data.type === 'PURCHASE_ITEM_CHANNEL_POST_DELETE') {
                    await this.deletePost(job.data.tgChannelId, job.data.tgMessageId);
                    return;
                }

                if (job.data.type === 'USER_ORDERS_REJECT') {
                    const rejectService = new UserOrdersRejectService(this.api);
                    await rejectService.rejectUserOrders(job.data.messageIds);
                    return;
                }

                const { purchaseItemId } = job.data;
                const isEdit = job.data.type === 'PURCHASE_ITEM_CHANNEL_POST_EDIT';
                await this.processPost(purchaseItemId, isEdit);
            },
            onFailed: (job, err) => {
                const target =
                    job.data.type === 'PURCHASE_ITEM_CHANNEL_POST_DELETE'
                        ? `messageId=${job.data.tgMessageId}`
                        : job.data.type === 'USER_ORDERS_REJECT'
                          ? `reject messages=${job.data.messageIds.length}`
                          : `purchaseItemId=${job.data.purchaseItemId}`;
                console.error(`[TG queue] Failed job ${job.id} (${target}): ${err.message}`);
            },
        });

        console.log('[TG queue] Purchase channel post worker started');
        return queue;
    }

    private async findPurchaseItemById(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        photos: {
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                            select: { id: true, objectKey: true, mimeType: true },
                        },
                    },
                },
                orderLines: { select: { quantity: true } },
                purchase: { select: { tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    async processPost(purchaseItemId: number, isEdit: boolean) {
        const item = await this.findPurchaseItemById(purchaseItemId);

        if (!item?.product) {
            throw new UnrecoverableError(`PurchaseItem ${purchaseItemId} not found`);
        }

        if (isEdit && item.tgMessageId && item.tgChannelId) {
            const firstPhoto = item.product.photos[0];
            const photo = firstPhoto ? await this.fetchPhoto(firstPhoto) : undefined;
            const text = buildProductPostText(item.product);
            await this.editPost(purchaseItemId, item.tgChannelId, Number(item.tgMessageId), text, photo);
            return;
        }

        // Guard: skip if already posted (prevents duplicates on retry / double-enqueue)
        if (!isEdit && item.tgMessageId) {
            console.log(`[TG queue] Item ${purchaseItemId} already posted (${item.tgMessageId}), skipping`);
            return;
        }

        const firstPhoto = item.product.photos[0];
        const photo = firstPhoto ? await this.fetchPhoto(firstPhoto) : undefined;
        const text = buildProductPostText(item.product);
        await this.createPost(purchaseItemId, text, photo);
    }

    private async fetchPhoto(photo: {
        id: number;
        objectKey: string;
        mimeType: string;
    }): Promise<ChannelPostPhoto | undefined> {
        const data = await loadProductPhoto(photo.objectKey);
        if (data?.length) {
            return productPhotoToAttachment(data, photo.mimeType);
        }

        const webappUrl = process.env.WEBAPP_URL?.trim();
        if (webappUrl) {
            try {
                const resp = await fetch(`${webappUrl.replace(/\/$/, '')}/api/photos/${photo.id}`);
                if (resp.ok) {
                    const arrayBuf = await resp.arrayBuffer();
                    return productPhotoToAttachment(Buffer.from(arrayBuf), photo.mimeType);
                }
                console.warn(`[TG queue] Failed to fetch photo ${photo.id} via WEBAPP_URL: ${resp.status}`);
            } catch (err: unknown) {
                console.warn(`[TG queue] Error fetching photo ${photo.id} via WEBAPP_URL:`, err);
            }
        }

        console.warn(`[TG queue] Photo unavailable for item (photoId=${photo.id}, key=${photo.objectKey})`);
        return undefined;
    }

    private async editPost(
        purchaseItemId: number,
        chatId: string,
        msgId: number,
        text: string,
        photo?: ChannelPostPhoto,
    ) {
        try {
            await this.applyPostEdit(chatId, msgId, text, photo);
            console.log(`[TG queue] Edited item ${purchaseItemId} → message ${msgId}`);
        } catch (err: unknown) {
            if (err instanceof GrammyError && err.description.includes('message is not modified')) {
                console.log(`[TG queue] Item ${purchaseItemId} — no changes, skipped`);
                return;
            }
            console.error(`[TG queue] Edit failed for item ${purchaseItemId}:`, err);
            throw err;
        }
    }

    private async applyPostEdit(chatId: string, msgId: number, text: string, photo?: ChannelPostPhoto) {
        const caption = text.slice(0, TELEGRAM_CAPTION_MAX);
        const messageText = text.slice(0, TELEGRAM_MESSAGE_MAX);

        if (photo) {
            try {
                await this.api.editMessageCaption(chatId, msgId, { caption, parse_mode: 'HTML' });
                return;
            } catch (err: unknown) {
                if (
                    err instanceof GrammyError &&
                    err.description.includes('there is no caption in the message to edit')
                ) {
                    await this.api.editMessageText(chatId, msgId, messageText, { parse_mode: 'HTML' });
                    return;
                }
                throw err;
            }
        }

        try {
            await this.api.editMessageText(chatId, msgId, messageText, { parse_mode: 'HTML' });
        } catch (err: unknown) {
            if (
                err instanceof GrammyError &&
                (err.description.includes("message can't be edited") ||
                    err.description.includes('there is no text in the message to edit'))
            ) {
                await this.api.editMessageCaption(chatId, msgId, { caption, parse_mode: 'HTML' });
                return;
            }
            throw err;
        }
    }

    private async createPost(purchaseItemId: number, text: string, photo?: ChannelPostPhoto) {
        console.log(`[TG queue] Item ${purchaseItemId}: photo=${!!photo}, text length=${text.length}`);

        const { messageId } = await this.publishToChannel(text, photo);

        await dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { tgMessageId: String(messageId), tgChannelId: this.channelId!, publicationState: 'PUBLISHED' },
        });

        try {
            const redis = getRedisConnection();
            const cacheKey = `tg_post_to_item:${this.channelId}:${messageId}`;
            await redis.set(cacheKey, String(purchaseItemId), 'EX', 86400);
        } catch (err: unknown) {
            console.warn('[TG queue] Redis cache for post mapping failed:', err);
        }

        let commentPosted = await waitUntilShopCommentPosted(messageId, 20_000);
        if (!commentPosted) {
            commentPosted = await postShopCommentInDiscussionWithRetry(this.api, messageId, 30_000);
        }
        if (!commentPosted) {
            console.warn(
                `[TG] Комментарий с кнопкой не появился под постом ${messageId}. ` +
                    'Бот — админ в группе обсуждений? @BotFather → Group Privacy → Turn off',
            );
        }

        console.log(`[TG queue] Posted item ${purchaseItemId} → message ${messageId}`);
    }

    private async publishToChannel(text: string, photo?: ChannelPostPhoto) {
        try {
            return await sendChannelPost(this.api, this.channelId!, text, photo);
        } catch (err: unknown) {
            console.error('[TG queue] sendChannelPost failed:', err);
            throw err;
        }
    }

    private async deletePost(tgChannelId: string, tgMessageId: string) {
        const chatId = tgChannelId;
        const messageId = Number(tgMessageId);
        if (!Number.isFinite(messageId)) {
            throw new UnrecoverableError(`Invalid tgMessageId: ${tgMessageId}`);
        }

        try {
            await this.api.deleteMessage(chatId, messageId);
            console.log(`[TG queue] Deleted channel message ${messageId}`);
        } catch (err: unknown) {
            if (err instanceof GrammyError && err.description.includes('message to delete not found')) {
                console.log(`[TG queue] Message ${messageId} already deleted, skipped`);
                return;
            }
            console.error(`[TG queue] Delete failed for message ${messageId}:`, err);
            throw err;
        }
    }
}
