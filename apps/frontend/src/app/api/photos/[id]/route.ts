import { NextRequest, NextResponse } from 'next/server';

import { storage } from '@/lib/server/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const photo = await storage.read(Number(id));

    if (!photo) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new Response(new Uint8Array(photo.data), {
        headers: {
            'Content-Type': photo.mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}
