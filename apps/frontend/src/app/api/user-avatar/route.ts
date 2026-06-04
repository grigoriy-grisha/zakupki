import { NextRequest, NextResponse } from 'next/server';

import { fetchRemoteAvatarBytes, isAllowedAvatarUrl } from '@/server/lib/remote-avatar';

export async function GET(req: NextRequest) {
    const raw = req.nextUrl.searchParams.get('url');
    if (!raw?.trim() || !isAllowedAvatarUrl(raw)) {
        return new NextResponse(null, { status: 400 });
    }

    const fetched = await fetchRemoteAvatarBytes(raw);
    if (!fetched) {
        return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(fetched.data, {
        headers: {
            'Content-Type': fetched.contentType,
            'Cache-Control': 'private, max-age=3600',
        },
    });
}
