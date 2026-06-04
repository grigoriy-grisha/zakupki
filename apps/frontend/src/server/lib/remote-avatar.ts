const MIN_AVATAR_BYTES = 400;
const FETCH_TIMEOUT_MS = 8_000;

function isImageContentType(contentType: string | null): boolean {
    if (!contentType) return false;
    const t = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    return t.startsWith('image/');
}

/** Байты похожи на картинку, а не HTML/пустой ответ. */
export function isUsableAvatarBytes(data: Buffer): boolean {
    if (data.length < MIN_AVATAR_BYTES) return false;
    if (data[0] === 0x3c || data[0] === 0x7b) return false;
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
    if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
    if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
        return true;
    }
    return data.length >= 800;
}

export function isAllowedAvatarUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        const host = u.hostname.toLowerCase();
        if (host === 't.me' || host.endsWith('.telegram.org') || host.endsWith('.telesco.pe')) return true;
        if (host.endsWith('.vkuserphoto.ru') || host.endsWith('.userapi.com')) return true;
        return false;
    } catch {
        return false;
    }
}

export async function fetchRemoteAvatarBytes(url: string): Promise<{ data: Buffer; contentType: string } | null> {
    if (!isAllowedAvatarUrl(url)) return null;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZakupkiBot/1.0)',
                Accept: 'image/*,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;

        const contentType = res.headers.get('content-type');
        if (!isImageContentType(contentType)) return null;

        const data = Buffer.from(await res.arrayBuffer());
        if (!isUsableAvatarBytes(data)) return null;

        return {
            data,
            contentType: contentType?.split(';')[0]?.trim() || 'image/jpeg',
        };
    } catch {
        return null;
    }
}

/** Не сохраняем URL, если по ссылке нет реальной аватарки (скрыто в TG/VK или битая ссылка). */
export async function resolveUsableAvatarUrl(url: string | null | undefined): Promise<string | null> {
    const trimmed = url?.trim();
    if (!trimmed) return null;
    const fetched = await fetchRemoteAvatarBytes(trimmed);
    return fetched ? trimmed : null;
}
