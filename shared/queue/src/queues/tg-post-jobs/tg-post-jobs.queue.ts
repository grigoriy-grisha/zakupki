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

    /**
     * Добавить джобу с уникальным jobId. Если передан jobId — сначала
     * вычищаем уже существующую не-active джобу с тем же id. Без этого
     * BullMQ воспримет второй add как дубликат и молча дропнет его: при
     * `removeOnComplete: 500` completed-джоба остаётся «живой» (её хэш
     * хранится в Redis), поэтому повторная публикация того же товара
     * (jobId `post-create-<id>`) навсегда терялась. Active джобы не
     * трогаем — сворачивание дублей «в полёте» сохраняется.
     */
    async addImmediate(data: TgPostJob, jobId?: string) {
        if (jobId) {
            await this.removeExistingNonActive(jobId);
        }
        return this.queue.add('tg-post-job', data, {
            jobId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }

    /**
     * Debounce: если джоба с таким jobId уже waiting/delayed/failed/completed —
     * удаляем и создаём новую. Воркер увидит джобу через DEBOUNCE_MS после
     * ПОСЛЕДНЕГО emit'а.
     */
    async addDebounced(jobId: string, data: TgPostJob) {
        await this.removeExistingNonActive(jobId);

        return this.queue.add('tg-post-job', data, {
            jobId,
            delay: DEBOUNCE_MS,
            attempts: 5,
            backoff: { type: 'exponential', delay: 5000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
        });
    }

    /**
     * Удаляет существующую джобу с заданным jobId, если она не active.
     * Только active jobs (уже выполняются) — не трогаем: сворачивание
     * дублей «в полёте» сохраняется. Всё остальное (waiting/delayed/
     * failed/completed) — удаляем, иначе BullMQ вернёт старую джобу
     * с тем же jobId и новый worker handler не запустится (обновления
     * постов «зависают», републикация молча теряется).
     */
    private async removeExistingNonActive(jobId: string): Promise<void> {
        const existing = await this.queue.getJob(jobId);
        if (!existing) return;
        const state = await existing.getState();
        if (state !== 'active') {
            await existing.remove();
        }
    }
}
