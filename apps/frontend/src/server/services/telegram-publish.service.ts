import { AppError, ValidationError } from '@zakupki/types';

import type { EventBus } from '@zakupki/queue';

export type TgPublishQueuedResult = { queued: number };

/**
 * Публикация товара в Telegram-канал. Тонкая обёртка над EventBus —
 * только валидирует конфиг и переводит ошибки в понятные сообщения.
 */
export class TelegramPublishService {
    constructor(private readonly eventBus: EventBus) {}

    private assertChannelConfigured(): void {
        const raw = (process.env.TELEGRAM_CHANNEL_ID ?? process.env.TG_CHANNEL_ID)?.trim();
        if (!raw) {
            throw new ValidationError('TG_CHANNEL_ID не задан в .env');
        }
    }

    async enqueuePurchaseItems(purchaseItemIds: number[]): Promise<number> {
        if (purchaseItemIds.length === 0) return 0;
        this.assertChannelConfigured();
        await Promise.all(purchaseItemIds.map((id) => this.eventBus.emitPostCreate(id)));
        return purchaseItemIds.length;
    }

    async enqueueIfEnabled(
        publishToTg: boolean | undefined,
        purchaseItemIds: number[],
    ): Promise<TgPublishQueuedResult | null> {
        if (!publishToTg || purchaseItemIds.length === 0) return null;
        const queued = await this.enqueuePurchaseItems(purchaseItemIds);
        return { queued };
    }

    /** Постановка в очередь после успешного addItems. */
    async enqueueAfterAddItems(
        publishToTg: boolean | undefined,
        purchaseItemIds: number[],
    ): Promise<TgPublishQueuedResult | null> {
        try {
            return await this.enqueueIfEnabled(publishToTg, purchaseItemIds);
        } catch (e) {
            if (e instanceof AppError) {
                throw new ValidationError(`${e.message}. Товары добавлены, но не поставлены в очередь.`);
            }
            throw e;
        }
    }

    async publishPurchaseItem(purchaseItemId: number): Promise<{ queued: boolean }> {
        const queued = await this.enqueuePurchaseItems([purchaseItemId]);
        return { queued: queued > 0 };
    }

    async enqueueDeleteChannelPost(itemId: number): Promise<void> {
        this.assertChannelConfigured();
        await this.eventBus.emitPostDelete(itemId);
    }
}
