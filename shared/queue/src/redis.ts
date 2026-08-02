import { Redis } from 'ioredis';

export { Redis as RedisClient };

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

const BULLMQ_REDIS_OPTS = { maxRetriesPerRequest: null } as const;

export function getRedisUrlFromEnv(): string {
    return process.env.REDIS_URL?.trim() || DEFAULT_REDIS_URL;
}

let redisSingleton: Redis | undefined;

export function getRedisConnection(): Redis {
    if (!redisSingleton) {
        // BullMQ workers use blocking Redis commands — maxRetriesPerRequest must be null
        redisSingleton = new Redis(getRedisUrlFromEnv(), BULLMQ_REDIS_OPTS);
    }
    return redisSingleton;
}
