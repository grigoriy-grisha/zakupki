import fs from 'node:fs/promises';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { dbClient, RoleKind } from '@zakupki/database';

import { authOptions } from '@/lib/auth';
import { getPublicUrlPrefix, isS3Configured, resolveLocalFilePath } from '@/lib/server/storage-config';
import { serviceContainer } from '@/server/lib/service-container';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const userId = Number(session?.user?.id);
    if (!session?.user?.id || !userId || Number.isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const paymentId = Number(id);
    if (!Number.isFinite(paymentId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payment = await dbClient.payment.findUnique({
        where: { id: paymentId },
        select: { userId: true, proofObjectKey: true },
    });

    if (!payment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const role = (await serviceContainer.user.getCachedRole(userId)) ?? RoleKind.CLIENT;
    if (payment.userId !== userId && role !== RoleKind.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payment.proofObjectKey) {
        if (!isS3Configured()) {
            try {
                const data = await fs.readFile(resolveLocalFilePath(payment.proofObjectKey));
                return new Response(data, {
                    headers: {
                        'Content-Type': 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                });
            } catch {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        }

        return NextResponse.redirect(`${getPublicUrlPrefix()}/${payment.proofObjectKey}`, 307);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
