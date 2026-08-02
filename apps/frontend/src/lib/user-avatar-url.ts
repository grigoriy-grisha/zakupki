/** Прокси для внешних аватарок (t.me, VK CDN) — обход hotlink и проверка на пустой ответ. */
export function toDisplayAvatarUrl(src: string | null | undefined): string | null {
    const trimmed = src?.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/')) return trimmed;

    try {
        const u = new URL(trimmed);
        const host = u.hostname.toLowerCase();
        const needsProxy =
            host === 't.me' ||
            host.endsWith('.telegram.org') ||
            host.endsWith('.telesco.pe') ||
            host.endsWith('.vkuserphoto.ru') ||
            host.endsWith('.userapi.com');
        if (needsProxy) {
            return `/api/user-avatar?url=${encodeURIComponent(trimmed)}`;
        }
    } catch {
        return null;
    }

    return trimmed;
}
