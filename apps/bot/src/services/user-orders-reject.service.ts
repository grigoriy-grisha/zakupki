import type { Api } from 'grammy';

import { getOrdersChatIdFromEnv } from '../lib/telegram-chat';

export class UserOrdersRejectService {
    constructor(private api: Api) {}

    async rejectUserOrders(messageIds: string[]): Promise<number> {
        const ordersChatId = getOrdersChatIdFromEnv();
        if (!ordersChatId) {
            console.warn('[reject] No orders chat configured');
            return 0;
        }

        if (messageIds.length === 0) return 0;

        let reacted = 0;

        for (const msgId of messageIds) {
            try {
                await this.api.setMessageReaction(ordersChatId, Number(msgId), [{ type: 'emoji', emoji: '👎' }]);
                reacted++;
            } catch (err) {
                console.warn(`[reject] Failed to set 👎 on message ${msgId}:`, err);
            }
        }

        console.log(`[reject] Set 👎 on ${reacted}/${messageIds.length} messages`);
        return reacted;
    }
}
