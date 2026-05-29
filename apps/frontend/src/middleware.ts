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

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const { platform, pathname: appPathname } = parseAppPath(pathname);

    //todo сделать авторизацию для api
    if (platform && appPathname.startsWith('/api/')) {
        return NextResponse.redirect(new URL(appPathname, request.url));
    }

    if (appPathname.startsWith('/_next') || appPathname.startsWith('/favicon')) {
        return NextResponse.next();
    }

    const finish = () => (platform ? rewriteApp(request, appPathname) : NextResponse.next());

    if (PUBLIC_PATH_PREFIXES.some((p) => appPathname.startsWith(p))) {
        if (!platform && appPathname === '/login') {
            const token = await getToken({ req: request });
            if (token) {
                return redirectApp(request, getHomePathForRole(token.role as string | undefined), null);
            }
        }
        return finish();
    }

    if (platform) {
        const token = await getToken({ req: request });
        if (token && isAdminOnlyRoute(appPathname) && token.role !== 'ADMIN') {
            return redirectApp(request, '/shop', platform);
        }
        return finish();
    }

    const token = await getToken({ req: request });
    if (!token) {
        return redirectApp(request, '/login', null);
    }

    if (isAdminOnlyRoute(appPathname) && token.role !== 'ADMIN') {
        return redirectApp(request, '/shop', null);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|photos|payment-proof).*)'],
};
