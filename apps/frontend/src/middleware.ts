import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import { PUBLIC_PATH_PREFIXES } from '@/lib/constants';
import { getHomePathForRole, isAdminOnlyRoute } from '@/lib/route-access';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
        if (pathname === '/login') {
            const token = await getToken({ req: request });
            if (token) {
                return NextResponse.redirect(
                    new URL(getHomePathForRole(token.role as string | undefined), request.url),
                );
            }
        }
        return NextResponse.next();
    }

    if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
        return NextResponse.next();
    }

    const token = await getToken({ req: request });
    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAdminOnlyRoute(pathname) && token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/shop', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|photos|payment-proof).*)'],
};
