import { NextResponse } from 'next/server';

import { dbClient } from '@zakupki/database';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const payment = await dbClient.payment.findUnique({
        where: { id: Number(id) },
        select: { proofData: true, proofMimeType: true },
    });

    if (!payment?.proofData) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new Response(new Uint8Array(payment.proofData), {
        headers: {
            'Content-Type': payment.proofMimeType ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}
