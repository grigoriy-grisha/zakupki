import { getRedisConnection } from '../../redis';
import { TgPostJobsQueue } from './tg-post-jobs.queue';

const FAST_QUEUE_NAME = 'tg-post-fast-jobs';

const globalForQueue = globalThis as typeof globalThis & {
    tgPostJobsQueue?: TgPostJobsQueue;
    tgPostFastJobsQueue?: TgPostJobsQueue;
};

export function getTgPostJobsQueue(): TgPostJobsQueue {
    globalForQueue.tgPostJobsQueue ??= new TgPostJobsQueue(getRedisConnection());
    return globalForQueue.tgPostJobsQueue;
}

export function getTgPostFastJobsQueue(): TgPostJobsQueue {
    globalForQueue.tgPostFastJobsQueue ??= new TgPostJobsQueue(getRedisConnection(), FAST_QUEUE_NAME);
    return globalForQueue.tgPostFastJobsQueue;
}

export { TgPostJobsQueue } from './tg-post-jobs.queue';
export type { TgPostJob } from './tg-post-jobs.types';
