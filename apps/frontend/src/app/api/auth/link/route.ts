import { dbClient } from '@zakupki/database';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import { verifyTelegram, verifyVk } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const token = await getToken({ req: request });
    if (!token?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, data } = body as { provider: 'vk' | 'telegram'; data: string };

    if (!provider || !data) {
        return NextResponse.json({ error: 'Missing provider or data' }, { status: 400 });
    }

    const userId = Number(token.id);

    try {
        if (provider === 'vk') {
            const verified = await verifyVk(data);
            if (!verified) {
                return NextResponse.json({ error: 'VK verification failed' }, { status: 400 });
            }

            const existing = await dbClient.user.findUnique({ where: { vkId: verified.providerAccountId } });
            if (existing && existing.id !== userId) {
                return NextResponse.json({ error: 'Этот VK-аккаунт уже привязан к другому пользователю' }, { status: 409 });
            }

            await dbClient.user.update({
                where: { id: userId },
                data: { vkId: verified.providerAccountId, avatarUrl: verified.avatar, vkAvatarUrl: verified.avatar },
            });

            return NextResponse.json({ ok: true });
        }

        if (provider === 'telegram') {
            const verified = await verifyTelegram(data);
            if (!verified) {
                return NextResponse.json({ error: 'Telegram verification failed' }, { status: 400 });
            }

            const existing = await dbClient.user.findUnique({ where: { telegramId: verified.providerAccountId } });
            if (existing && existing.id !== userId) {
                return NextResponse.json({ error: 'Этот Telegram-аккаунт уже привязан к другому пользователю' }, { status: 409 });
            }

            await dbClient.user.update({
                where: { id: userId },
                data: {
                    telegramId: verified.providerAccountId,
                    username: verified.username ?? undefined,
                    avatarUrl: verified.avatar,
                    telegramAvatarUrl: verified.avatar,
                },
            });

            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    } catch (err) {
        console.error('[auth/link] error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const token = await getToken({ req: request });
    if (!token?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { provider } = body as { provider: 'vk' | 'telegram' };

    if (!provider) {
        return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
    }

    const userId = Number(token.id);
    const field = provider === 'vk' ? 'vkId' : 'telegramId';
    const otherField = provider === 'vk' ? 'telegramId' : 'vkId';

    const user = await dbClient.user.findUnique({ where: { id: userId } });
    if (!user || !user[field]) {
        return NextResponse.json({ error: 'Account not linked' }, { status: 400 });
    }
    if (!user[otherField]) {
        return NextResponse.json({ error: 'Cannot unlink the last authentication method' }, { status: 400 });
    }

    await dbClient.user.update({
        where: { id: userId },
        data: { [field]: null },
    });

    return NextResponse.json({ ok: true });
}
