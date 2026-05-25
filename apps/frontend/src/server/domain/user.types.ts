export const USER_PROFILE_INCLUDE = {
    telegramCredential: {
        select: {
            telegramId: true,
            username: true,
            avatarUrl: true,
        },
    },
    vkCredential: {
        select: {
            vkId: true,
            avatarUrl: true,
        },
    },
} as const;

export type VerifiedAccount = {
    providerAccountId: string;
    name: string;
    avatar: string | null;
    username?: string | null;
};

export type UpsertOAuthProfile = {
    firstName: string;
    lastName?: string;
    avatarUrl?: string | null;
};
