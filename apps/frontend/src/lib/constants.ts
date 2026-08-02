export { PLATFORM_PREFIXES } from '@/lib/app-path';

export const PUBLIC_PATH_PREFIXES = ['/login', '/webapp', '/api/auth', '/api/trpc', '/api/photos'] as const;

export const ADMIN_ONLY_PREFIXES = ['/', '/purchases', '/products', '/users', '/settings'] as const;
