import { NextRequest, NextResponse } from 'next/server';

import { storage } from '@/lib/server/storage';

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const productId = Number(formData.get('productId'));
    const sortOrder = Number(formData.get('sortOrder') ?? 0);

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only images allowed' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
        const photoId = await storage.upload(productId, bytes, file.type, sortOrder);
        return NextResponse.json({ id: photoId });
    } catch (err) {
        console.error('[upload]', err);
        const message = err instanceof Error ? err.message : 'Upload failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
