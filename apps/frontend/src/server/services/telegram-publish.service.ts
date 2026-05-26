import { TRPCError } from '@trpc/server';
import type { TelegramChannelPostQueue } from '@zakupki/queue';

import { getTelegramChannelPostQueue } from '../lib/telegram-channel-post-queue';

export type TgPublishQueuedResult = { queued: number };

export class TelegramPublishService {
    constructor(private readonly queue: TelegramChannelPostQueue = getTelegramChannelPostQueue()) {}

    private assertChannelConfigured(): void {
        const raw = (process.env.TELEGRAM_CHANNEL_ID ?? process.env.TG_CHANNEL_ID)?.trim();
        if (!raw) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'TG_CHANNEL_ID не задан в .env',
            });
        }
    }

    async enqueuePurchaseItems(purchaseItemIds: number[]): Promise<number> {
        if (purchaseItemIds.length === 0) return 0;

        this.assertChannelConfigured();

        await Promise.all(
            purchaseItemIds.map((purchaseItemId) =>
                this.queue.addPurchaseItemPost({
                    type: 'PURCHASE_ITEM_CHANNEL_POST',
                    purchaseItemId,
                }),
            ),
        );

        console.log(`[TG queue] Enqueued ${purchaseItemIds.length} post(s)`);
        return purchaseItemIds.length;
    }

    async enqueueIfEnabled(
        publishToTg: boolean | undefined,
        purchaseItemIds: number[],
    ): Promise<TgPublishQueuedResult | null> {
        if (!publishToTg || purchaseItemIds.length === 0) {
            return null;
        }

        const queued = await this.enqueuePurchaseItems(purchaseItemIds);
        return { queued };
    }

    /**
     * Постановка в очередь после успешного addItems.
     * При ошибке конфигурации — TRPC с пояснением, что товары уже в закупке.
     */
    async enqueueAfterAddItems(
        publishToTg: boolean | undefined,
        purchaseItemIds: number[],
    ): Promise<TgPublishQueuedResult | null> {
        try {
            return await this.enqueueIfEnabled(publishToTg, purchaseItemIds);
        } catch (e) {
            if (e instanceof TRPCError) {
                throw new TRPCError({
                    code: e.code,
                    message: `${e.message}. Товары добавлены, но не поставлены в очередь.`,
                });
            }
            throw e;
        }
    }

    async enqueueEditPurchaseItem(purchaseItemId: number) {
        this.assertChannelConfigured();
        await this.queue.addPurchaseItemPost({
            type: 'PURCHASE_ITEM_CHANNEL_POST_EDIT',
            purchaseItemId,
        });
        console.log(`[TG queue] Enqueued edit for purchase item ${purchaseItemId}`);
    }

    async publishPurchaseItem(purchaseItemId: number): Promise<{ queued: boolean }> {
        const queued = await this.enqueuePurchaseItems([purchaseItemId]);
        return { queued: queued > 0 };
    }
}
