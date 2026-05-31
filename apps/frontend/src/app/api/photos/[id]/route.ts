import fs from 'node:fs/promises';

import { NextRequest, NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

import { getPublicUrlPrefix, isS3Configured, resolveLocalFilePath } from '@/lib/server/storage-config';

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

    if (!isS3Configured()) {
        try {
            const data = await fs.readFile(resolveLocalFilePath(photo.objectKey));
            return photoResponse(data, photo.mimeType, photo.objectKey);
        } catch {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    }

    try {
        const resp = await fetch(`${getPublicUrlPrefix()}/${photo.objectKey}`);
        if (!resp.ok) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const data = await resp.arrayBuffer();
        return photoResponse(data, photo.mimeType, photo.objectKey);
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}
