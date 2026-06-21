import { getActiveBotConfig } from '../config/bot-config';

/** @deprecated Использовать `container.cfg.webapp.url`. */
export function getWebAppUrl(): string | null {
    const baseUrl = getActiveBotConfig().webapp.url;
    if (!baseUrl) return null;
    return `${baseUrl}/tg/webapp`;
}

function isHttpsUrl(url: string): boolean {
    try {
        return new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
}

/** Кнопка в личке: web_app только с HTTPS, иначе обычная ссылка (localhost не ломает /start). */
export function shopStartKeyboard() {
    const webAppUrl = getWebAppUrl();
    if (webAppUrl && isHttpsUrl(webAppUrl)) {
        return {
            inline_keyboard: [[{ text: '🛒 Открыть магазин', web_app: { url: webAppUrl } }]],
        };
    }
    return shopUrlKeyboard();
}

/** Кнопка для групп и комментариев — только url (web_app в комментариях не поддерживается). */
export function shopInlineKeyboardForGroup() {
    return shopUrlKeyboard();
}

/** Запасной вариант — ссылка t.me, если WEBAPP_URL не задан. */
export function shopUrlKeyboard() {
    const link = getActiveBotConfig().webapp.miniAppUrl || getWebAppUrl();
    if (!link) return undefined;

    return {
        inline_keyboard: [[{ text: '🛒 Открыть магазин', url: link }]],
    };
}
