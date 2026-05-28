import { AuthDataValidator } from '@telegram-auth/server';
import { RoleKind } from '@zakupki/database';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { buildRbac, type RbacConfig } from '@/lib/rbac-config';
import { createRoleService, createUserService } from '@/server/lib/create-user-service';

export async function verifyVk(rawData: string) {
    const appId = process.env.NEXT_PUBLIC_VK_APP_ID;
    if (!appId) throw new Error('NEXT_PUBLIC_VK_APP_ID is not set');

    const { accessToken } = JSON.parse(rawData);
    if (!accessToken) return null;

    const userInfoResponse = await fetch('https://id.vk.com/oauth2/user_info', {
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
    pages: { signIn: '/login' },
    providers: [
        CredentialsProvider({
            id: 'vk',
            name: 'VK',
            credentials: { data: { type: 'text' } },
            async authorize(credentials) {
                if (!credentials?.data) return null;
                const verified = await verifyVk(credentials.data);
                if (!verified) return null;
                return createUserService().signInWithVk(verified);
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
                return createUserService().signInWithTelegram(verified);
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.avatar = user.image;
            }

            if (token.id) {
                token.role = await createRoleService().getUserRoleKind(Number(token.id));
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.image = token.avatar as string | null;
                session.user.role = token.role ?? RoleKind.CLIENT;
                session.user.rbac = buildRbac(session.user.role);
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
            rbac: RbacConfig;
        };
    }
    interface User {
        role?: RoleKind;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        avatar?: string | null;
        role?: RoleKind;
    }
}
