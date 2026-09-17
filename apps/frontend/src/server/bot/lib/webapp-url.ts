import type { BotConfig } from '../config/bot-config';
import { getActiveBotConfig } from '../config/bot-config';

export function getWebAppUrl(): string | null {
    const baseUrl = getActiveBotConfig().webapp.url;
    if (!baseUrl) return null;
    return `${baseUrl}/tg/webapp`;
}

export function normalizeHttpsUrl(url: string): string | null {
    try {
        const parsed = new URL(url.replace(/\/$/, ''));
        if (parsed.protocol !== 'https:') return null;
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
}

export function shopStartKeyboard() {
    const webAppUrl = getWebAppUrl();
    if (webAppUrl && normalizeHttpsUrl(webAppUrl)) {
        return {
            inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: webAppUrl } }]],
        };
    }
    return shopUrlKeyboard();
}

export function shopUrlKeyboard(purchaseId?: number, itemId?: number) {
    const link =
        purchaseId != null
            ? buildShopTargetUrl(purchaseId, itemId)
            : getActiveBotConfig().webapp.miniAppUrl || getWebAppUrl();
    if (!link) return undefined;

    return {
        inline_keyboard: [[{ text: 'Открыть приложение', url: link }]],
    };
}

export function buildShopTargetUrl(purchaseId: number, itemId?: number): string | null {
    return shopTargetDeepLink(getActiveBotConfig(), purchaseId, itemId)?.url ?? null;
}

export function shopTargetDeepLink(
    cfg: BotConfig,
    purchaseId: number,
    itemId?: number,
): { url: string; telegram: boolean } | null {
    const base = normalizeHttpsUrl(cfg.webapp.miniAppUrl ?? cfg.webapp.url ?? '');
    if (!base) return null;
    return { url: buildMiniAppTargetUrl(base, purchaseId, itemId), telegram: isTelegramDeepLink(base) };
}

export function buildMiniAppTargetUrl(base: string, purchaseId: number, itemId?: number): string {
    if (isTelegramDeepLink(base)) {
        const startApp = itemId != null ? `p${purchaseId}i${itemId}` : `p${purchaseId}`;
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}startapp=${startApp}`;
    }
    const path = itemId != null ? `/tg/shop/purchase/${purchaseId}/item/${itemId}` : `/tg/shop/purchase/${purchaseId}`;
    return `${base.replace(/\/$/, '')}${path}`;
}

export function isTelegramDeepLink(url: string): boolean {
    const host = new URL(url).hostname.toLowerCase();
    return host === 't.me' || host.endsWith('.t.me');
}
