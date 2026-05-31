import { loadProductPhoto } from '@zakupki/storage';
import { NextRequest, NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

function photoResponse(data: ArrayBuffer | Buffer, mimeType: string, objectKey: string) {
    return new Response(data, {
        headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400',
            ETag: `"${objectKey}"`,
        },
    });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const photo = await dbClient.productPhoto.findUnique({
        where: { id: Number(id) },
        select: { objectKey: true, mimeType: true },
    });

    if (!photo) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = await loadProductPhoto(photo.objectKey);
    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return photoResponse(data, photo.mimeType, photo.objectKey);
}
