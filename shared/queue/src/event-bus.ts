import { getTgPostJobsQueue, type TgPostJobsQueue } from './queues/tg-post-jobs';

/**
 * Тонкая обёртка над tg-post-jobs очередью. Сервисы вызывают emit-методы,
 * не работая с BullMQ напрямую.
 *
 *   - addImmediate: для одноразовых операций (создание/удаление постов).
 *     jobId = `${type}-${id}` → BullMQ deduplication: повторный add игнорируется.
 *   - addDebounced: для реактивных обновлений (изменения товара, статус закупки).
 *     window = 7s. BullMQ jobId обеспечивает coalesce.
 */
export class EventBus {
    constructor(private readonly queue: TgPostJobsQueue = getTgPostJobsQueue()) {}

    emitPostCreate(itemId: number) {
        return this.queue.addImmediate({ type: 'POST_CREATE', itemId }, `post-create-${itemId}`);
    }

    emitPostDelete(itemId: number, messageId?: string, channelId?: string) {
        return this.queue.addImmediate(
            { type: 'POST_DELETE', itemId, messageId, channelId },
            `post-delete-${itemId}`,
        );
    }

    emitUserOrdersReject(messageIds: string[]) {
        return this.queue.addImmediate({ type: 'USER_ORDERS_REJECT', messageIds });
    }

    emitItemChanged(itemId: number) {
        return this.queue.addDebounced(`item-${itemId}`, { type: 'ITEM_CHANGED', itemId });
    }

    /** @deprecated алиас для emitItemChanged (обратная совместимость). */
    emitPurchaseItemChanged(itemId: number) {
        return this.emitItemChanged(itemId);
    }

    emitPurchaseFulfillmentChanged(purchaseId: number, prev: string, next: string) {
        return this.queue.addDebounced(`fulfillment-${purchaseId}`, {
            type: 'PURCHASE_FULFILLMENT_CHANGED',
            purchaseId,
            prev,
            next,
        });
    }

    emitPurchaseStatusChanged(purchaseId: number, prev: string, next: string) {
        return this.queue.addDebounced(`status-${purchaseId}`, {
            type: 'PURCHASE_STATUS_CHANGED',
            purchaseId,
            prev,
            next,
        });
    }
}
