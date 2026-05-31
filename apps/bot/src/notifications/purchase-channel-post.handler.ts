import type { Bot } from 'grammy';
import type { RedisClient } from '@zakupki/queue';

import type { CustomContext } from '../domain/types';
import { ChannelPostService } from '../services/channel-post.service';

export function setupPurchaseChannelPostHandler(
    bot: Bot<CustomContext>,
    { redis }: { redis: RedisClient },
) {
    const service = new ChannelPostService(bot.api);
    return service.setupWorker(redis);
}
