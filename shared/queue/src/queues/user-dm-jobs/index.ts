import { getRedisConnection } from '../../redis';
import { UserDmJobsQueue } from './user-dm-jobs.queue';

const globalForQueue = globalThis as typeof globalThis & {
    userDmJobsQueue?: UserDmJobsQueue;
};

export function getUserDmJobsQueue(): UserDmJobsQueue {
    globalForQueue.userDmJobsQueue ??= new UserDmJobsQueue(getRedisConnection());
    return globalForQueue.userDmJobsQueue;
}

export { UserDmJobsQueue } from './user-dm-jobs.queue';
export type { UserDmJob } from './user-dm-jobs.types';
