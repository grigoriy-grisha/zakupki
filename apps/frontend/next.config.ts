import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
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
    allowedDevOrigins: [
        'fabulously-profuse-dobsonfly.cloudpub.ru',
        'prudishly-jocular-dachshund.cloudpub.ru',
    ],
};

export default nextConfig;
