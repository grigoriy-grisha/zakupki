import { ADMIN_ONLY_PREFIXES } from '@/lib/constants';

export function getHomePathForRole(role: string | undefined): string {
    if (role === 'ADMIN') return '/';
    return '/shop';
}

export function isAdminOnlyRoute(pathname: string): boolean {
    return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
