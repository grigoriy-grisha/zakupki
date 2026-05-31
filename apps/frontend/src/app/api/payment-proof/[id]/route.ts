import { NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

const PUBLIC_URL_PREFIX = process.env.YANDEX_PUBLIC_URL_PREFIX || `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET_NAME}`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const payment = await dbClient.payment.findUnique({
        where: { id: Number(id) },
        select: { proofData: true, proofObjectKey: true, proofMimeType: true },
    });

    if (!payment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (payment.proofObjectKey) {
        return NextResponse.redirect(`${PUBLIC_URL_PREFIX}/${payment.proofObjectKey}`, 307);
    }

    if (payment.proofData) {
        return new Response(new Uint8Array(payment.proofData), {
            headers: {
                'Content-Type': payment.proofMimeType ?? 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
