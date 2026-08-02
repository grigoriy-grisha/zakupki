import type { Redis } from 'ioredis';

import { BaseQueue } from '../_base/base.queue';
import type { UserDmJob } from './user-dm-jobs.types';

const QUEUE_NAME = 'user-dm-jobs';

/**
 * Queue for delivering user-facing notifications as Telegram direct messages.
 *
 * Separate from `tg-post-jobs` so the two delivery paths don't share a rate
 * limit (channel posts are rate-limited at 10/30s, which would throttle DMs
 * if they were enqueued on the same queue). DM delivery is lighter (no photo
 * upload) so we allow higher concurrency and a softer limiter.
 */
export class UserDmJobsQueue extends BaseQueue<UserDmJob> {
    constructor(connection: Redis) {
        super(QUEUE_NAME, connection, {
            workerOptions: {
                concurrency: 5,
                limiter: { max: 20, duration: 30_000 },
            },
        });
    }

    /**
     * Enqueue a DM delivery for a single notification. Deduped by jobId derived
     * from the notification id — BullMQ drops duplicates with the same jobId.
     */
    addImmediate(data: UserDmJob) {
        const jobId = `dm-${data.notificationId}`;
        return this.queue.add('user-dm-job', data, {
            jobId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }

    /**
     * Enqueue a debounced DM delivery: the worker fires `delay` ms after the
     * LAST call for this notification id. Used by coalescable notifications
     * (ORDER_QTY_CHANGED) so a burst of admin edits within the delay window
     * produces a single push with the final "было X, стало Y" body, instead of
     * one push per intermediate value.
     *
     * The worker reads `body` from the Notification row at processing time,
     * so any payload update during the delay is picked up automatically — we
     * don't need to update the job data, only reset the delay timer.
     *
     * If a job with the same jobId already exists and is not currently active,
     * we remove it and add a fresh one so the delay timer restarts from now.
     * Failed jobs are also replaced (otherwise BullMQ would return the stale
     * failed job and the worker handler wouldn't re-run).
     */
    async addDebounced(data: UserDmJob, delay: number) {
        const jobId = `dm-${data.notificationId}`;
        const existing = await this.queue.getJob(jobId);

        if (existing) {
            const state = await existing.getState();
            // Don't touch a job that's currently being processed — otherwise
            // we could double-fire delivery (one from the active handler and
            // one from the re-enqueued job).
            if (state !== 'active') {
                await existing.remove();
            }
        }

        return this.queue.add('user-dm-job', data, {
            jobId,
            delay,
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }
}
