import { dbClient, ensureClientRole, getUserRoleKind, RoleKind } from '@zakupki/database';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { ROUTES, VK_USER_INFO_URL } from '@/lib/constants';

async function verifyVk(rawData: string) {
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

export const authOptions: NextAuthOptions = {
    session: { strategy: 'jwt' },
    pages: { signIn: ROUTES.login.path },
    providers: [
        CredentialsProvider({
            id: 'vk',
            name: 'VK',
            credentials: {
                data: { type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.data) return null;

                const verified = await verifyVk(credentials.data);
                if (!verified) return null;

                const [firstName, ...rest] = verified.name.split(' ');
                const lastName = rest.join(' ') || undefined;
                const vkId = verified.providerAccountId;

                const user = await dbClient.user.upsert({
                    where: { vkId },
                    update: { firstName, lastName, avatarUrl: verified.avatar },
                    create: {
                        vkId,
                        firstName,
                        lastName,
                        avatarUrl: verified.avatar,
                    },
                });

                await ensureClientRole(user.id);
                const role = await getUserRoleKind(user.id);

                return {
                    id: String(user.id),
                    name: verified.name,
                    image: verified.avatar,
                    role,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.avatar = user.image;
                token.role =
                    'role' in user && user.role === RoleKind.ADMIN ? RoleKind.ADMIN : RoleKind.CLIENT;
            } else if (token.id && !token.role) {
                token.role = await getUserRoleKind(Number(token.id));
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.image = token.avatar as string | null;
                session.user.role =
                    token.role === RoleKind.ADMIN ? RoleKind.ADMIN : RoleKind.CLIENT;
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
