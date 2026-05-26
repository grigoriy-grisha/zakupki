import { getRedisConnection, TelegramChannelPostQueue } from '@zakupki/queue';

const globalForQueue = globalThis as typeof globalThis & {
    telegramChannelPostQueue?: TelegramChannelPostQueue;
};

export function getTelegramChannelPostQueue(): TelegramChannelPostQueue {
    globalForQueue.telegramChannelPostQueue ??= new TelegramChannelPostQueue(getRedisConnection());
    return globalForQueue.telegramChannelPostQueue;
}
