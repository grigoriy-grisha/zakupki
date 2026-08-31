import type { Redis } from 'ioredis';

import { BaseQueue } from '../_base/base.queue';
import type { UserDmJob } from './user-dm-jobs.types';

const QUEUE_NAME = 'user-dm-jobs';

export class UserDmJobsQueue extends BaseQueue<UserDmJob> {
    constructor(connection: Redis) {
        super(QUEUE_NAME, connection, {
            workerOptions: {
                concurrency: 5,
                limiter: { max: 20, duration: 30_000 },
            },
        });
    }

    async addImmediate(data: UserDmJob) {
        const jobId = `dm-${data.notificationId}`;
        await this.removeStaleJob(jobId);
        return this.queue.add('user-dm-job', data, {
            jobId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000, jitter: 0.5 },
            removeOnComplete: { age: 86_400, count: 500 },
            removeOnFail: 1000,
        });
    }

    private async removeStaleJob(jobId: string): Promise<void> {
        const existing = await this.queue.getJob(jobId);
        if (!existing) return;
        if ((await existing.getState()) === 'active') return;
        await existing.remove();
    }

    async addDebounced(data: UserDmJob, delay: number) {
        const jobId = `dm-${data.notificationId}`;
        await this.removeStaleJob(jobId);

        return this.queue.add('user-dm-job', data, {
            jobId,
            delay,
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000, jitter: 0.5 },
            removeOnComplete: { age: 86_400, count: 500 },
            removeOnFail: 1000,
        });
    }
}
