import { Redis } from 'ioredis';

export { Redis as RedisClient };

export type RedisConfig = {
    host: string;
    port: number;
    password?: string;
    username?: string;
};

export function getRedisConfigFromEnv(): RedisConfig {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 6379,
            password: parsed.password || undefined,
            username: parsed.username || undefined,
        };
    }

    return {
        host: process.env.REDIS_HOST?.trim() || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD?.trim() || undefined,
        username: process.env.REDIS_USER?.trim() || undefined,
    };
}

let redisSingleton: Redis | undefined;

const BULLMQ_REDIS_OPTS = { maxRetriesPerRequest: null } as const;

export function getRedisConnection(): Redis {
    if (!redisSingleton) {
        const url = process.env.REDIS_URL?.trim();
        // BullMQ workers use blocking Redis commands — maxRetriesPerRequest must be null
        redisSingleton = url
            ? new Redis(url, BULLMQ_REDIS_OPTS)
            : new Redis({ ...getRedisConfigFromEnv(), ...BULLMQ_REDIS_OPTS });
    }
    return redisSingleton;
}
