export function getWebAppUrl(): string | null {
    const baseUrl = process.env.WEBAPP_URL?.trim();
    if (!baseUrl) return null;
    return `${baseUrl.replace(/\/$/, '')}/tg/webapp`;
}

/** Кнопка для групп и комментариев (Mini App). */
export function shopInlineKeyboardForGroup() {
    const url = getWebAppUrl();
    if (!url) return shopUrlKeyboard();

    return {
        inline_keyboard: [[{ text: '🛒 Открыть магазин', web_app: { url } }]],
    };
}

/** Запасной вариант — ссылка t.me, если WEBAPP_URL не задан. */
export function shopUrlKeyboard() {
    const link = process.env.TELEGRAM_MINI_APP_URL?.trim() || getWebAppUrl();
    if (!link) return undefined;

    return {
        inline_keyboard: [[{ text: '🛒 Открыть магазин', url: link }]],
    };
}
