import { dbClient } from '@zakupki/database';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const token = await getToken({ req: request });
    if (!token?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await dbClient.user.findUnique({
        where: { id: Number(token.id) },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            username: true,
            vkId: true,
            telegramId: true,
            vkAvatarUrl: true,
            telegramAvatarUrl: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
}
