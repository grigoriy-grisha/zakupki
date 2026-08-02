import { isValid } from '@tma.js/init-data-node';

import type { VerifiedAccount } from '@/server/domain/user.types';
import { resolveUsableAvatarUrl } from '@/server/lib/remote-avatar';

const BEARER_PREFIX = 'Bearer ';

export interface TelegramWebAppUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
}

export function extractTelegramInitData(req: Request): string | null {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith(BEARER_PREFIX) ? authHeader.slice(BEARER_PREFIX.length) : null;

    if (!token || token === 'null' || token === 'undefined') {
        return null;
    }

    return token;
}

export function parseTelegramWebAppUser(initData: string): TelegramWebAppUser | null {
    const userParam = new URLSearchParams(initData).get('user');
    if (!userParam) return null;

    try {
        return JSON.parse(userParam) as TelegramWebAppUser;
    } catch {
        return null;
    }
}

export async function verifyTelegramInitData(initData: string): Promise<VerifiedAccount | null> {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return null;

    try {
        if (!isValid(initData, botToken)) return null;
    } catch {
        return null;
    }

    const userData = parseTelegramWebAppUser(initData);
    if (!userData?.id) return null;

    const firstName = userData.first_name ?? '';
    const lastName = userData.last_name ?? '';
    const username = userData.username ?? null;

    const avatar = await resolveUsableAvatarUrl(userData.photo_url ?? null);

    return {
        providerAccountId: String(userData.id),
        name: [firstName, lastName].filter(Boolean).join(' ') || username || 'User',
        avatar,
        username,
    };
}
