import type { InlineKeyboardMarkup } from 'grammy/types';

import type { BotConfig } from '../config/bot-config';

export function buildOpenPurchaseKeyboard(payload: unknown, cfg: BotConfig): InlineKeyboardMarkup | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const purchaseId = (payload as { purchaseId?: unknown }).purchaseId;
    if (typeof purchaseId !== 'number' || !Number.isFinite(purchaseId)) return null;

    const baseUrl = cfg.webapp.miniAppUrl ?? cfg.webapp.url;
    if (!baseUrl) return null;

    const base = normalizeHttpsUrl(baseUrl);
    if (!base) return null;

    if (isTelegramDeepLink(base)) {
        return {
            inline_keyboard: [[{ text: 'Открыть закупку', url: base }]],
        };
    }
    return {
        inline_keyboard: [
            [{ text: 'Открыть закупку', web_app: { url: `${base}/tg/webapp/shop/purchase/${purchaseId}` } }],
        ],
    };
}

function normalizeHttpsUrl(url: string): string | null {
    try {
        const parsed = new URL(url.replace(/\/$/, ''));
        if (parsed.protocol !== 'https:') return null;
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
}

function isTelegramDeepLink(url: string): boolean {
    const host = new URL(url).hostname.toLowerCase();
    return host === 't.me' || host.endsWith('.t.me');
}
