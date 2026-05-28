import type { PrismaClient } from '@zakupki/database';
import type { Bot } from 'grammy';
import type { RedisClient } from '@zakupki/queue';

import type { CustomContext } from '../domain/types';
import { ChannelPostService } from '../services/channel-post.service';

export function setupPurchaseChannelPostHandler(
    bot: Bot<CustomContext>,
    { redis, db }: { redis: RedisClient; db: PrismaClient },
) {
    const service = new ChannelPostService(bot.api, db);
    return service.setupWorker(redis);
}
