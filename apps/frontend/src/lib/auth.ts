import { AuthDataValidator } from '@telegram-auth/server';
import { dbClient, ensureClientRole, getUserRoleKind, RoleKind } from '@zakupki/database';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { ROUTES, VK_USER_INFO_URL } from '@/lib/constants';

export async function verifyVk(rawData: string) {
    const appId = process.env.NEXT_PUBLIC_VK_APP_ID;
    if (!appId) throw new Error('NEXT_PUBLIC_VK_APP_ID is not set');

    const { accessToken } = JSON.parse(rawData);
    if (!accessToken) return null;

    const userInfoResponse = await fetch(VK_USER_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            access_token: accessToken,
            client_id: appId,
        }),
    });

    const userInfo = await userInfoResponse.json();
    if (!userInfo.user) return null;

    const vkUser = userInfo.user;
    return {
        providerAccountId: String(vkUser.user_id),
        name: [vkUser.first_name, vkUser.last_name].filter(Boolean).join(' '),
        avatar: vkUser.avatar || vkUser.photo_200 || null,
    };
}

export async function verifyTelegram(rawData: string) {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) throw new Error('BOT_TOKEN is not set');

    const validator = new AuthDataValidator({ botToken });
    const parsed = JSON.parse(rawData) as Record<string, string | number>;
    const dataMap = new Map(Object.entries(parsed)) as Map<string, string | number>;
    const tgUser = await validator.validate(dataMap).catch(() => null);
    if (!tgUser) return null;

    const firstName = typeof tgUser.first_name === 'string' ? tgUser.first_name : '';
    const lastName = typeof tgUser.last_name === 'string' ? tgUser.last_name : '';
    const username = typeof parsed.username === 'string' ? parsed.username : null;

    return {
        providerAccountId: String(tgUser.id),
        name: [firstName, lastName].filter(Boolean).join(' ') || username || 'User',
        avatar: typeof tgUser.photo_url === 'string' ? tgUser.photo_url : null,
        username,
    };
}

export const authOptions: NextAuthOptions = {
    session: { strategy: 'jwt' },
    pages: { signIn: ROUTES.login.path },
    providers: [
        CredentialsProvider({
            id: 'vk',
            name: 'VK',
            credentials: { data: { type: 'text' } },
            async authorize(credentials) {
                if (!credentials?.data) return null;
                const verified = await verifyVk(credentials.data);
                if (!verified) return null;

                const [firstName, ...rest] = verified.name.split(' ');
                const lastName = rest.join(' ') || undefined;
                const user = await dbClient.user.upsert({
                    where: { vkId: verified.providerAccountId },
                    update: { firstName, lastName, avatarUrl: verified.avatar, vkAvatarUrl: verified.avatar },
                    create: { vkId: verified.providerAccountId, firstName, lastName, avatarUrl: verified.avatar, vkAvatarUrl: verified.avatar },
                });
                await ensureClientRole(user.id);
                const role = await getUserRoleKind(user.id);
                return { id: String(user.id), name: verified.name, image: verified.avatar, role };
            },
        }),
        CredentialsProvider({
            id: 'telegram',
            name: 'Telegram',
            credentials: { data: { type: 'text' } },
            async authorize(credentials) {
                if (!credentials?.data) return null;
                const verified = await verifyTelegram(credentials.data);
                if (!verified) return null;

                const [firstName, ...rest] = verified.name.split(' ');
                const lastName = rest.join(' ') || undefined;
                const user = await dbClient.user.upsert({
                    where: { telegramId: verified.providerAccountId },
                    update: { firstName, lastName, avatarUrl: verified.avatar, telegramAvatarUrl: verified.avatar, username: verified.username ?? undefined },
                    create: {
                        telegramId: verified.providerAccountId,
                        firstName,
                        lastName,
                        avatarUrl: verified.avatar,
                        telegramAvatarUrl: verified.avatar,
                        username: verified.username ?? undefined,
                    },
                });
                await ensureClientRole(user.id);
                const role = await getUserRoleKind(user.id);
                return { id: String(user.id), name: verified.name, image: verified.avatar, role };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.avatar = user.image;
                token.role = 'role' in user && user.role === RoleKind.ADMIN ? RoleKind.ADMIN : RoleKind.CLIENT;
            } else if (token.id && !token.role) {
                token.role = await getUserRoleKind(Number(token.id));
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.image = token.avatar as string | null;
                session.user.role = token.role === RoleKind.ADMIN ? RoleKind.ADMIN : RoleKind.CLIENT;
            }
            return session;
        },
    },
};

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: RoleKind;
        };
    }
    interface User { role?: RoleKind; }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        avatar?: string | null;
        role?: RoleKind;
    }
}
