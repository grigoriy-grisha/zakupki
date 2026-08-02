export const PLATFORM_PREFIXES = ['tg', 'vk'] as const;

export type Platform = (typeof PLATFORM_PREFIXES)[number];

export function isPlatform(value: string): value is Platform {
    return (PLATFORM_PREFIXES as readonly string[]).includes(value);
}

export function parseAppPath(pathname: string): { platform: Platform | null; pathname: string } {
    for (const platform of PLATFORM_PREFIXES) {
        const prefix = `/${platform}`;
        if (pathname === prefix) {
            return { platform, pathname: '/' };
        }
        if (pathname.startsWith(`${prefix}/`)) {
            const stripped = pathname.slice(prefix.length);
            return { platform, pathname: stripped || '/' };
        }
    }
    return { platform: null, pathname };
}

export function withPlatformPrefix(path: string, platform: Platform): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const { platform: existing } = parseAppPath(normalized);
    if (existing) {
        return normalized;
    }
    if (normalized === '/') {
        return `/${platform}`;
    }
    return `/${platform}${normalized}`;
}

export function isNavActive(appPathname: string, href: string): boolean {
    if (href === '/') return appPathname === '/';
    return appPathname === href || appPathname.startsWith(`${href}/`);
}
