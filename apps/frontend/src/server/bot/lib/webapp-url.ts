export function getWebAppUrl(): string | null {
    const baseUrl = process.env.WEBAPP_URL?.trim();
    if (!baseUrl) return null;
    return `${baseUrl.replace(/\/$/, '')}/tg/webapp`;
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
    const link = process.env.TELEGRAM_MINI_APP_URL?.trim() || getWebAppUrl();
    if (!link) return undefined;

    return {
        inline_keyboard: [[{ text: '🛒 Открыть магазин', url: link }]],
    };
}
