import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    transpilePackages: ['@zakupki/database'],
    serverExternalPackages: ['@prisma/client'],
    outputFileTracingRoot: path.join(__dirname, '../../'),
    outputFileTracingIncludes: {
        './**': ['../../shared/database/generated/**/*'],
    },
    allowedDevOrigins: ['prudishly-jocular-dachshund.cloudpub.ru']

};

export default nextConfig;
