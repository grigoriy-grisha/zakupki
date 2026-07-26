import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import { type Platform, parseAppPath, withPlatformPrefix } from '@/lib/app-path';
import { PUBLIC_PATH_PREFIXES } from '@/lib/constants';
import { getHomePathForRole, isAdminOnlyRoute } from '@/lib/route-access';

function redirectApp(request: NextRequest, path: string, platform: Platform | null) {
    const target = platform ? withPlatformPrefix(path, platform) : path;
    return NextResponse.redirect(new URL(target, request.url));
}

function rewriteApp(request: NextRequest, appPathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = appPathname;
    return NextResponse.rewrite(url);
}

function redirectIfNotAdmin(
    _request: NextRequest,
    appPathname: string,
    platform: Platform | null,
    role: string | undefined,
) {
    if (!role || !isAdminOnlyRoute(appPathname)) return null;
    if (role !== 'ADMIN') {
        return redirectApp(_request, '/shop', platform);
    }
    return null;
}

// Read the role straight from the JWT created at login. We only read the
// cookie here, so no maxAge override is needed — next-auth manages the cookie
// lifetime itself. If the role changes in the DB, the user must re-login to
// refresh the JWT.
const JWT_OPTIONS = {
    secret: process.env.NEXTAUTH_SECRET,
    cookies: { sessionToken: { name: 'next-auth.session-token' } },
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const { platform, pathname: appPathname } = parseAppPath(pathname);

    if (appPathname.startsWith('/_next') || appPathname.startsWith('/favicon')) {
        return NextResponse.next();
    }

    const finish = () => (platform ? rewriteApp(request, appPathname) : NextResponse.next());

    // Для публичных маршрутов — редирект с /login на home при уже залогиненном пользователе
    if (PUBLIC_PATH_PREFIXES.some((p) => appPathname.startsWith(p))) {
        if (!platform && appPathname === '/login') {
            const token = await getToken({ req: request, ...JWT_OPTIONS });
            if (token?.role) {
                return redirectApp(request, getHomePathForRole(token.role), null);
            }
        }
        return finish();
    }

    // Для платформенных маршрутов (/tg/, /vk/) — проверяем admin
    if (platform) {
        const token = await getToken({ req: request, ...JWT_OPTIONS });
        const denied = redirectIfNotAdmin(request, appPathname, platform, token?.role);
        if (denied) return denied;
        return finish();
    }

    // Для внутренних маршрутов — требуем авторизации
    const token = await getToken({ req: request, ...JWT_OPTIONS });
    if (!token) {
        return redirectApp(request, '/login', null);
    }

    const denied = redirectIfNotAdmin(request, appPathname, null, token.role);
    if (denied) return denied;

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api/photos|api/payment-proof).*)'],
};
