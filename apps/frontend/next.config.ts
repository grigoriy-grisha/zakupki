import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    transpilePackages: ['@zakupki/storage'],
    serverExternalPackages: [
        '@prisma/client',
        '@prisma/client-runtime-utils',
        '@prisma/adapter-pg',
        '@prisma/runtime',
        '@prisma/engine-core',
        '@prisma/engines',
        '@zakupki/database',
    ],
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Свои туннели для разработки (cloudpub и т.п.) — в .env.local, через запятую.
    allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
};

export default nextConfig;
