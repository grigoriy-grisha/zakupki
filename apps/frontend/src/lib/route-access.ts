import { ADMIN_ONLY_PREFIXES, ROUTES } from '@/lib/constants';

export function getHomePathForRole(role: string | undefined): string {
    if (role === 'ADMIN') return ROUTES.home.path;
    return ROUTES.shop.path;
}

export function isAdminOnlyRoute(pathname: string): boolean {
    return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
