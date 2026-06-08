import { type RedisClient, getRedisConnection } from '@zakupki/queue';
import { getUnitByCode } from '@zakupki/types';
import { serviceContainer } from '@/server/lib/service-container';
import { dbClient } from '@zakupki/database';

import { getChannelIdFromEnv } from '../lib/telegram-post';
import { allTelegramPostRefs, type ReplyToMessage, walkReplyChain } from '../lib/resolve-reply-purchase-item';
import { parseOrderQuantity } from '../lib/parse-order-quantity';

export type OrderCollectionResult =
    | {
          ok: true;
          productName: string;
          purchaseItemId: number;
          internalUserId: number;
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
    private redis: RedisClient;

    constructor(redis?: RedisClient) {
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
            await this.redis.set(key, String(id), 'EX', 86400);
        } catch (err) {
            console.error('[Redis cache] error:', err);
        }
    }

    private async findPurchaseItemById(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        photos: { orderBy: { sortOrder: 'asc' }, take: 1, select: { id: true, objectKey: true, mimeType: true } },
                    },
                },
                orderLines: { select: { quantity: true } },
                purchase: { select: { tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    private async findPurchaseItemByTelegramPost(channelId: string, messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: { tgMessageId: messageId, tgChannelId: channelId, publicationState: 'PUBLISHED' },
            include: {
                product: true,
                orderLines: { select: { quantity: true } },
                purchase: { select: { id: true, tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    private async findPurchaseItemByTgMessageId(messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: { tgMessageId: messageId, publicationState: 'PUBLISHED' },
            include: {
                product: true,
                orderLines: { select: { quantity: true } },
                purchase: { select: { id: true, tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    async resolvePurchaseItemFromReply(chatId: number, replyTo: ReplyToMessage) {
        const refs = allTelegramPostRefs(chatId, replyTo);

        for (const ref of refs) {
            const cacheKey = `tg_post_to_item:${ref.channelId}:${ref.messageId}`;
            const cachedId = await this.getCachedPurchaseItemId(cacheKey);
            if (cachedId) {
                const item = await this.findPurchaseItemById(cachedId);
                if (item) return item;
            }

            const item = await this.findPurchaseItemByTelegramPost(ref.channelId, ref.messageId);
            if (item) {
                await this.setCachedPurchaseItemId(cacheKey, item.id);
                return item;
            }
        }

        for (const msg of walkReplyChain(replyTo)) {
            const cacheKey = `tg_msg_to_item:${chatId}:${msg.message_id}`;
            const cachedId = await this.getCachedPurchaseItemId(cacheKey);
            if (cachedId) {
                const item = await this.findPurchaseItemById(cachedId);
                if (item) return item;
            }

            const item = await this.findPurchaseItemByTgMessageId(String(msg.message_id));
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
                return this.findPurchaseItemById(cachedId);
            }

            const item = await this.findPurchaseItemByTelegramPost(channelId, String(threadId));
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
        messageId?: number;
    }): Promise<OrderCollectionResult> {
        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message:
                    'Напишите количество числом, например: 10 (граммов) или +2п (две пачки) или -1п (снять пачку)',
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

        const user = await serviceContainer.user.createOrGetUser(params.telegramId, params.userInfo);
        const unitShort = getUnitByCode(purchaseItem.product.unitCode)?.shortName ?? 'ед.';
        const minPackaging = Number(purchaseItem.product.minPackageAmount) ||
            Number(purchaseItem.product.multiplicity) || 1;
        const packSize = purchaseItem.product.supplierPackageAmount != null
            ? Number(purchaseItem.product.supplierPackageAmount)
            : null;

        try {
            // Определяем delta в зависимости от типа и количества
            let delta: number;
            if (parsed.unit === 'packs' && packSize != null) {
                // +2п → delta = 2 * packSize; -1п → delta = -1 * packSize
                const count = Math.round(parsed.amount);
                delta = parsed.kind === 'add' ? count * packSize : -count * packSize;
            } else {
                // +10 → delta = 10; -5 → delta = -5 (округляем до шага)
                const steps = Math.round(parsed.amount / minPackaging);
                delta = parsed.kind === 'add' ? steps * minPackaging : -steps * minPackaging;
            }

            await serviceContainer.order.adjustQuantity(purchaseItem.id, user.id, delta);

            // Читаем обновлённый заказ
            const updatedLine = await dbClient.orderLine.findUnique({
                where: { purchaseItemId_userId: { purchaseItemId: purchaseItem.id, userId: user.id } },
            });

            if (!updatedLine) {
                // Заказ удалён
                return {
                    ok: true,
                    productName: purchaseItem.product.name,
                    purchaseItemId: purchaseItem.id,
                    internalUserId: user.id,
                    quantity: 0,
                    unitShort,
                    amountDue: 0,
                    purchaseTag: purchaseItem.purchase.tag,
                    cancelled: true,
                };
            }

            const quantity = Number(updatedLine.quantity);
            const amountDue = Number(updatedLine.amountDue);

            return {
                ok: true,
                productName: purchaseItem.product.name,
                purchaseItemId: purchaseItem.id,
                internalUserId: user.id,
                quantity,
                unitShort,
                amountDue,
                purchaseTag: purchaseItem.purchase.tag,
                added: parsed.kind === 'add' ? parsed.amount : undefined,
                subtracted: parsed.kind === 'subtract' ? parsed.amount : undefined,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сохранить заказ';
            return { ok: false, reason: 'error', message };
        }
    }
}
