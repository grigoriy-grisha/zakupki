export type AvatarSource = {
    avatarUrl: string | null;
    telegramCredential?: { avatarUrl: string | null } | null;
    vkCredential?: { avatarUrl: string | null } | null;
};

export type NameSource = {
    firstName: string;
    lastName: string | null;
};

export function resolveAvatarUrl(user: AvatarSource): string | null {
    return user.avatarUrl ?? user.telegramCredential?.avatarUrl ?? user.vkCredential?.avatarUrl ?? null;
}

export function displayName(user: NameSource): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
