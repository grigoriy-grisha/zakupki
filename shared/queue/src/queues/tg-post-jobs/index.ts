import { getRedisConnection } from '../../redis';
import { TgPostJobsQueue } from './tg-post-jobs.queue';

const globalForQueue = globalThis as typeof globalThis & {
    tgPostJobsQueue?: TgPostJobsQueue;
};

export function getTgPostJobsQueue(): TgPostJobsQueue {
    globalForQueue.tgPostJobsQueue ??= new TgPostJobsQueue(getRedisConnection());
    return globalForQueue.tgPostJobsQueue;
}

export { TgPostJobsQueue } from './tg-post-jobs.queue';
export type { TgPostJob } from './tg-post-jobs.types';
