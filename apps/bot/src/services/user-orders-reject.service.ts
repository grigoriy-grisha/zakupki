import type { Api } from 'grammy';
import { getRedisConnection } from '@zakupki/queue';
import { dbClient } from '@zakupki/database';

import { getOrdersChatIdFromEnv } from '../lib/telegram-chat';

export class UserOrdersRejectService {
    constructor(private api: Api) {}

    async rejectUserOrders(purchaseId: number, userId: number): Promise<number> {
        const ordersChatId = getOrdersChatIdFromEnv();
        if (!ordersChatId) {
            console.warn('[reject] No orders chat configured');
            return 0;
        }

        // Get all purchaseItems in this purchase
        const items = await dbClient.purchaseItem.findMany({
            where: { purchaseId },
            select: { id: true },
        });

        if (items.length === 0) return 0;

        const redis = getRedisConnection();
        let reacted = 0;

        for (const item of items) {
            const cacheKey = `user_order_msg:${ordersChatId}:${item.id}:${userId}`;
            const msgId = await redis.get(cacheKey);
            if (!msgId) continue;

            try {
                await this.api.setMessageReaction(ordersChatId, Number(msgId), [{ type: 'emoji', emoji: '👎' }]);
                reacted++;
                // Remove cache entry after use
                await redis.del(cacheKey);
            } catch (err) {
                console.warn(`[reject] Failed to set 👎 on message ${msgId}:`, err);
            }
        }

        console.log(`[reject] Set 👎 on ${reacted} messages for user ${userId} in purchase ${purchaseId}`);
        return reacted;
    }
}
