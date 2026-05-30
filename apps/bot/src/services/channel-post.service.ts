import type { Api } from 'grammy';
import type { PrismaClient } from '@zakupki/database';
import type { RedisClient } from '@zakupki/queue';
import { GrammyError } from 'grammy';
import { TelegramChannelPostQueue, UnrecoverableError } from '@zakupki/queue';

import { TELEGRAM_CAPTION_MAX, TELEGRAM_MESSAGE_MAX } from '../domain/constants';
import { PurchaseItemRepository } from '../domain/repositories/purchase-item.repository';
import {
    buildProductPostText,
    getChannelIdFromEnv,
    productPhotoToAttachment,
    sendChannelPost,
} from '../lib/telegram-post';
export class ChannelPostService {
    private repo: PurchaseItemRepository;
    private channelId: string | null;

    constructor(
        private api: Api,
        db: PrismaClient,
    ) {
        this.repo = new PurchaseItemRepository(db);
        this.channelId = getChannelIdFromEnv();
    }

    setupWorker(redis: RedisClient): TelegramChannelPostQueue {
        const queue = new TelegramChannelPostQueue(redis);

        if (!this.channelId) {
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
                await this.processPost(purchaseItemId, isEdit);
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

    async processPost(purchaseItemId: number, isEdit: boolean) {
        const item = await this.repo.findById(purchaseItemId);

        if (!item?.product) {
            throw new UnrecoverableError(`PurchaseItem ${purchaseItemId} not found`);
        }

        const firstPhoto = item.product.photos[0];
        const photo =
            firstPhoto && firstPhoto.data.byteLength > 0 ? productPhotoToAttachment(firstPhoto) : undefined;

        const text = buildProductPostText(item.product);

        if (isEdit && item.tgMessageId && item.tgChannelId) {
            await this.editPost(purchaseItemId, item.tgChannelId, Number(item.tgMessageId), text, photo);
            return;
        }

        await this.createPost(purchaseItemId, text, photo);
    }

    private async editPost(
        purchaseItemId: number,
        chatId: string,
        msgId: number,
        text: string,
        photo?: import('../domain/types').ChannelPostPhoto,
    ) {
        try {
            if (photo) {
                await this.api.editMessageCaption(chatId, msgId, {
                    caption: text.slice(0, TELEGRAM_CAPTION_MAX),
                    parse_mode: 'HTML',
                });
            } else {
                await this.api.editMessageText(chatId, msgId, text.slice(0, TELEGRAM_MESSAGE_MAX), {
                    parse_mode: 'HTML',
                });
            }
            console.log(`[TG queue] Edited item ${purchaseItemId} → message ${msgId}`);
        } catch (err) {
            if (err instanceof GrammyError && err.description.includes('message is not modified')) {
                console.log(`[TG queue] Item ${purchaseItemId} — no changes, skipped`);
            } else {
                console.error(`[TG queue] Edit failed for item ${purchaseItemId}:`, err);
                throw err;
            }
        }
    }

    private async createPost(
        purchaseItemId: number,
        text: string,
        photo?: import('../domain/types').ChannelPostPhoto,
    ) {
        console.log(`[TG queue] Item ${purchaseItemId}: photo=${!!photo}, text length=${text.length}`);

        let messageId: number;
        try {
            ({ messageId } = await sendChannelPost(this.api, this.channelId!, text, photo));
        } catch (err) {
            console.error(`[TG queue] sendChannelPost failed for item ${purchaseItemId}:`, err);
            throw err;
        }

        await this.repo.updateTelegramMessage(purchaseItemId, String(messageId), this.channelId!);

        console.log(`[TG queue] Posted item ${purchaseItemId} → message ${messageId}`);
    }
}
