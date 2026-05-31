import { calculateOrderAmount } from '@zakupki/types';
import type { Redis } from 'ioredis';
import { getRedisConnection } from '@zakupki/queue';

import { OrderRepository } from '../domain/repositories/order.repository';
import { PurchaseItemRepository } from '../domain/repositories/purchase-item.repository';

import { parseOrderQuantity } from '../lib/parse-order-quantity';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import { allTelegramPostRefs, type ReplyToMessage, walkReplyChain } from '../lib/resolve-reply-purchase-item';
import { UserService } from './user.service';

export type OrderCollectionResult =
    | {
          ok: true;
          productName: string;
          quantity: number;
          unitShort: string;
          amountDue: number;
          purchaseTag: string;
          added?: number;
          subtracted?: number;
          cancelled?: boolean;
      }
    | { ok: false; reason: 'invalid_quantity' | 'product_not_found' | 'purchase_inactive' | 'error'; message: string };

export class OrderCollectionService {
    private purchaseItems: PurchaseItemRepository;
    private orders: OrderRepository;
    private users: UserService;
    private redis: Redis;

    constructor(redis?: Redis) {
        this.purchaseItems = new PurchaseItemRepository();
        this.orders = new OrderRepository();
        this.users = new UserService();
        this.redis = redis ?? getRedisConnection();
    }

    private async getCachedPurchaseItemId(key: string): Promise<number | null> {
        try {
            const val = await this.redis.get(key);
            return val ? Number(val) : null;
        } catch {
            return null;
        }
    }

    private async setCachedPurchaseItemId(key: string, id: number): Promise<void> {
        try {
            await this.redis.set(key, String(id), 'EX', 86400); // 24 hours TTL
        } catch (err) {
            console.error('[Redis cache] error:', err);
        }
    }

    async resolvePurchaseItemFromReply(chatId: number, replyTo: ReplyToMessage) {
        const refs = allTelegramPostRefs(chatId, replyTo);

        for (const ref of refs) {
            const cacheKey = `tg_post_to_item:${ref.channelId}:${ref.messageId}`;
            const cachedId = await this.getCachedPurchaseItemId(cacheKey);
            if (cachedId) {
                const item = await this.purchaseItems.findById(cachedId);
                if (item) return item;
            }

            const item = await this.purchaseItems.findByTelegramPost(ref.channelId, ref.messageId);
            if (item) {
                await this.setCachedPurchaseItemId(cacheKey, item.id);
                return item;
            }
        }

        for (const msg of walkReplyChain(replyTo)) {
            const cacheKey = `tg_msg_to_item:${chatId}:${msg.message_id}`;
            const cachedId = await this.getCachedPurchaseItemId(cacheKey);
            if (cachedId) {
                const item = await this.purchaseItems.findById(cachedId);
                if (item) return item;
            }

            const item = await this.purchaseItems.findByTgMessageId(String(msg.message_id));
            if (item) {
                await this.setCachedPurchaseItemId(cacheKey, item.id);
                if (item.tgChannelId && item.tgMessageId) {
                    const postKey = `tg_post_to_item:${item.tgChannelId}:${item.tgMessageId}`;
                    await this.setCachedPurchaseItemId(postKey, item.id);
                }
                return item;
            }
        }

        return null;
    }

    async resolvePurchaseItemFromMessage(
        chatId: number,
        message: { reply_to_message?: ReplyToMessage; message_thread_id?: number },
    ) {
        // Telegram не отдаёт вложенный reply_to_message — ответ на комментарий бота
        // не содержит ссылку на пост канала, только message_thread_id темы.
        if (message.reply_to_message) {
            const fromReply = await this.resolvePurchaseItemFromReply(chatId, message.reply_to_message);
            if (fromReply) return fromReply;
        }

        const channelId = getChannelIdFromEnv();
        const threadId = message.message_thread_id ?? message.reply_to_message?.message_thread_id;
        if (channelId && threadId != null) {
            const cacheKey = `tg_post_to_item:${channelId}:${threadId}`;
            const cachedId = await this.getCachedPurchaseItemId(cacheKey);
            if (cachedId) {
                return this.purchaseItems.findById(cachedId);
            }

            const item = await this.purchaseItems.findByTelegramPost(channelId, String(threadId));
            if (item) {
                await this.setCachedPurchaseItemId(cacheKey, item.id);
            }
            return item;
        }

        return null;
    }

    async collectFromReply(params: {
        chatId: number;
        replyTo?: ReplyToMessage;
        threadId?: number;
        text: string;
        telegramId: string;
        userInfo: { firstName: string; lastName?: string; username?: string };
    }): Promise<OrderCollectionResult> {
        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message: 'Напишите количество числом, например: 10 или -5',
            };
        }

        const purchaseItem = await this.resolvePurchaseItemFromMessage(params.chatId, {
            reply_to_message: params.replyTo,
            message_thread_id: params.threadId,
        });

        if (!purchaseItem?.product) {
            return {
                ok: false,
                reason: 'product_not_found',
                message: 'Не найден товар для этого сообщения',
            };
        }

        const status = purchaseItem.purchase.status;
        if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
            return {
                ok: false,
                reason: 'purchase_inactive',
                message: 'Закупка не принимает заказы',
            };
        }

        const user = await this.users.createOrGetUser(params.telegramId, params.userInfo);
        const unitShort = purchaseItem.product.unit?.shortName ?? 'ед.';
        const pricing = {
            priceTiers: purchaseItem.product.priceTiers,
            pricePerUnit: Number(purchaseItem.product.pricePerUnit),
            priceOverride: purchaseItem.priceOverride != null ? Number(purchaseItem.priceOverride) : null,
        };

        const existingLine = await this.orders.findByPurchaseItemAndUser(purchaseItem.id, user.id);
        const currentQty = existingLine ? Number(existingLine.quantity) : 0;

        let newQuantity: number;
        let added: number | undefined;
        let subtracted: number | undefined;

        if (parsed.kind === 'add') {
            added = parsed.amount;
            newQuantity = currentQty + parsed.amount;
        } else {
            if (currentQty <= 0) {
                return {
                    ok: false,
                    reason: 'error',
                    message: 'У вас нет заказа по этому товару',
                };
            }
            if (parsed.amount > currentQty) {
                return {
                    ok: false,
                    reason: 'error',
                    message: `В заказе ${formatQty(currentQty)} ${unitShort}, нельзя убрать ${formatQty(parsed.amount)} ${unitShort}`,
                };
            }
            subtracted = parsed.amount;
            newQuantity = currentQty - parsed.amount;
        }

        try {
            if (newQuantity <= 0) {
                if (existingLine) {
                    await this.orders.deleteAndRestoreStock(existingLine.id);
                }
                return {
                    ok: true,
                    productName: purchaseItem.product.name,
                    quantity: 0,
                    unitShort,
                    amountDue: 0,
                    purchaseTag: purchaseItem.purchase.tag,
                    subtracted,
                    cancelled: true,
                };
            }

            const amountDue = calculateOrderAmount(newQuantity, pricing);
            await this.orders.upsertWithStock(purchaseItem.id, user.id, newQuantity, amountDue);

            return {
                ok: true,
                productName: purchaseItem.product.name,
                quantity: newQuantity,
                unitShort,
                amountDue,
                purchaseTag: purchaseItem.purchase.tag,
                added,
                subtracted,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сохранить заказ';
            return { ok: false, reason: 'error', message };
        }
    }
}

function formatQty(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}
