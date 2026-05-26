import type { Job, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

export type BaseQueueOptions = {
    queueOptions?: Partial<QueueOptions>;
    workerOptions?: Partial<WorkerOptions>;
};

export abstract class BaseQueue<DataType = unknown, ResultType = unknown, NameType extends string = string> {
    public readonly queue: Queue<DataType, ResultType, NameType>;
    protected worker?: Worker<DataType, ResultType, NameType>;
    protected readonly workerConfig: Partial<WorkerOptions> & { connection: Redis };

    protected constructor(
        queueName: string,
        connection: Redis,
        { queueOptions = {}, workerOptions = {} }: BaseQueueOptions = {},
    ) {
        this.queue = new Queue(queueName, { ...queueOptions, connection });
        this.workerConfig = { ...workerOptions, connection };
    }

    public setupWorker({
        handler,
        onCompleted,
        onFailed,
    }: {
        handler: Processor<DataType, ResultType, NameType>;
        onFailed?: (job: Job<DataType, ResultType, NameType>, err: Error) => unknown;
        onCompleted?: (job: Job<DataType, ResultType, NameType>, result: ResultType) => unknown;
    }): Worker<DataType, ResultType, NameType> {
        if (this.worker) throw new Error('Worker is already initialized');

        this.worker = new Worker<DataType, ResultType, NameType>(this.queue.name, handler, this.workerConfig);

        if (onCompleted) {
            this.worker.on('completed', onCompleted);
        }

        if (onFailed) {
            this.worker.on('failed', (job, error) => {
                if (!job) {
                    console.error(`${this.queue.name}: Job is undefined`, error);
                    return;
                }

                if (error.name === 'UnrecoverableError' || job.attemptsMade >= (job.opts?.attempts || 1)) {
                    onFailed(job, error);
                }
            });
        }

        return this.worker;
    }
}
