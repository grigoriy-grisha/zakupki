import { NextRequest, NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

const PUBLIC_URL_PREFIX = process.env.YANDEX_PUBLIC_URL_PREFIX || `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET_NAME}`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const photo = await dbClient.productPhoto.findUnique({
        where: { id: Number(id) },
        select: { objectKey: true },
    });

    if (!photo) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.redirect(`${PUBLIC_URL_PREFIX}/${photo.objectKey}`, 307);
}
