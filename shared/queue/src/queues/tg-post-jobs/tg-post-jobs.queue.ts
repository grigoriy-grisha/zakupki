import type { Redis } from 'ioredis';

import { BaseQueue } from '../_base/base.queue';
import type { TgPostJob } from './tg-post-jobs.types';

const QUEUE_NAME = 'tg-post-jobs';
const DEBOUNCE_MS = 7_000;

export class TgPostJobsQueue extends BaseQueue<TgPostJob> {
    constructor(connection: Redis) {
        super(QUEUE_NAME, connection, {
            workerOptions: {
                concurrency: 1,
                limiter: { max: 10, duration: 30_000 },
            },
        });
    }

    /** Добавить джобу с уникальным jobId (BullMQ сам отбросит дубликаты). */
    addImmediate(data: TgPostJob, jobId?: string) {
        return this.queue.add('tg-post-job', data, {
            jobId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }

    /**
     * Debounce: если джоба с таким jobId уже waiting/delayed/failed — удаляем
     * и создаём новую. Воркер увидит джобу через DEBOUNCE_MS после
     * ПОСЛЕДНЕГО emit'а.
     *
     * ВАЖНО: failed jobs тоже удаляем. Иначе при следующем emit'е BullMQ
     * вернёт старый failed job (тот же jobId) и новый worker handler не
     * запустится — обновления постов "зависают" до рестарта воркера.
     */
    async addDebounced(jobId: string, data: TgPostJob) {
        const existing = await this.queue.getJob(jobId);

        if (existing) {
            const state = await existing.getState();
            // Только active jobs (уже выполняются) — не трогаем. Всё остальное
            // (waiting/delayed/failed/completed) — удаляем, чтобы новая джоба
            // корректно встала в очередь.
            if (state !== 'active') {
                await existing.remove();
            }
        }

        return this.queue.add('tg-post-job', data, {
            jobId,
            delay: DEBOUNCE_MS,
            attempts: 5,
            backoff: { type: 'exponential', delay: 5000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }
}
