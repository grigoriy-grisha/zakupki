import type { Redis } from 'ioredis';

import { BaseQueue } from '../_base/base.queue';
import type { TelegramChannelPostJob } from './telegram-channel-post.types';

const QUEUE_NAME = 'telegram-channel-post';
const JOB_NAME = 'telegram-channel-post';

export class TelegramChannelPostQueue extends BaseQueue<TelegramChannelPostJob> {
    constructor(connection: Redis) {
        super(QUEUE_NAME, connection, {
            workerOptions: {
                concurrency: 1,
                limiter: {
                    max: 10,
                    duration: 30_000,
                },
            },
        });
    }

    async addPurchaseItemPost(data: TelegramChannelPostJob) {
        return this.queue.add(JOB_NAME, data, {
            attempts: 10,
            backoff: {
                type: 'exponential',
                delay: 2000,
                jitter: 0.5,
            },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }
}
