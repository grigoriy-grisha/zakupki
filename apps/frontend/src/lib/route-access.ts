import { ADMIN_ONLY_PREFIXES } from '@/lib/constants';

export function getHomePathForRole(role: string | undefined): string {
    if (role === 'ADMIN') return '/';
    return '/shop';
}

/** Routes that require ADMIN (dashboard root is exact `/` only). */
export function isAdminOnlyRoute(pathname: string): boolean {
    for (const prefix of ADMIN_ONLY_PREFIXES) {
        if (prefix === '/') {
            if (pathname === '/') return true;
            continue;
        }
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
            return true;
        }
    }
    return false;
}
