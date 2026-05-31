import pino from 'pino';

const root = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
        process.env.NODE_ENV !== 'production'
            ? { target: 'pino/file', options: { destination: 1 } } // stdout, pretty via pino cli
            : undefined,
});

/**
 * Create a child logger scoped to a module.
 *
 * @example
 * const log = createLogger('order-service');
 * log.info({ userId, quantity }, 'Order created');
 */
export function createLogger(module: string) {
    return root.child({ module });
}

export type Logger = ReturnType<typeof createLogger>;
