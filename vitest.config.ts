import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedTypes = fileURLToPath(new URL('./shared/types/src/index.ts', import.meta.url));
const sharedDatabase = fileURLToPath(new URL('./shared/database/src/database.ts', import.meta.url));
const sharedQueue = fileURLToPath(new URL('./shared/queue/src/main.ts', import.meta.url));
const sharedStorage = fileURLToPath(new URL('./shared/storage/src/index.ts', import.meta.url));
const sharedLogger = fileURLToPath(new URL('./shared/logger/src/index.ts', import.meta.url));

export default defineConfig({
    test: {
        globals: true,
        include: ['**/__tests__/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@zakupki/types': sharedTypes,
            '@zakupki/database': sharedDatabase,
            '@zakupki/queue': sharedQueue,
            '@zakupki/storage': sharedStorage,
            '@zakupki/logger': sharedLogger,
        },
    },
});
