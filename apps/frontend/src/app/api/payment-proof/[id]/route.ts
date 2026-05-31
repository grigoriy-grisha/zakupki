import fs from 'node:fs/promises';

import { NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

import { getPublicUrlPrefix, isS3Configured, resolveLocalFilePath } from '@/lib/server/storage-config';

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
        if (!isS3Configured()) {
            try {
                const data = await fs.readFile(resolveLocalFilePath(payment.proofObjectKey));
                return new Response(data, {
                    headers: {
                        'Content-Type': payment.proofMimeType ?? 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                });
            } catch {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        }

        return NextResponse.redirect(`${getPublicUrlPrefix()}/${payment.proofObjectKey}`, 307);
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
