export const USER_CREDENTIALS_INCLUDE = {
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

/** Для select — role скаляр, не relation. */
export const USER_PROFILE_SELECT = {
    role: true,
    ...USER_CREDENTIALS_INCLUDE,
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
