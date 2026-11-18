/** Где открыли приложение (зеркало enum VisitPlatform из Prisma). */
export const VISIT_PLATFORMS = ['TELEGRAM', 'VK', 'WEB'] as const;
export type VisitPlatform = (typeof VISIT_PLATFORMS)[number];

export const VISIT_PLATFORM_LABELS: Record<VisitPlatform, string> = {
    TELEGRAM: 'Telegram',
    VK: 'ВКонтакте',
    WEB: 'Сайт',
};

/** Тип устройства (зеркало enum VisitDevice из Prisma). */
export const VISIT_DEVICES = ['MOBILE', 'TABLET', 'DESKTOP'] as const;
export type VisitDevice = (typeof VISIT_DEVICES)[number];

export const VISIT_DEVICE_LABELS: Record<VisitDevice, string> = {
    MOBILE: 'Телефон',
    TABLET: 'Планшет',
    DESKTOP: 'Компьютер',
};

/** Грубое определение устройства по User-Agent: телефон, планшет или компьютер. */
export function detectVisitDevice(userAgent: string | null | undefined): VisitDevice {
    const ua = userAgent ?? '';
    if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'TABLET';
    if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(ua)) return 'MOBILE';
    return 'DESKTOP';
}

/** Площадка по пути страницы (/tg/…, /vk/…) и признаку мини-приложения Telegram. */
export function detectVisitPlatform(pathname: string | null | undefined, telegramInitData: boolean): VisitPlatform {
    if (telegramInitData) return 'TELEGRAM';
    if (pathname?.startsWith('/tg/') || pathname === '/tg' || pathname?.startsWith('/webapp')) return 'TELEGRAM';
    if (pathname?.startsWith('/vk/') || pathname === '/vk') return 'VK';
    return 'WEB';
}
