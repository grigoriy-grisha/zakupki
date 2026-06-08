import { InlineKeyboard } from 'grammy';

export function getMiniAppUrl(): string | null {
    const direct = process.env.TELEGRAM_MINI_APP_URL?.trim();
    if (direct) return direct;

    const botUsername = (process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_BOT_USERNAME)?.trim();
    const shortName = process.env.TELEGRAM_MINI_APP_SHORT_NAME?.trim();
    if (botUsername && shortName) {
        return `https://t.me/${botUsername.replace(/^@/, '')}/${shortName}`;
    }

    return null;
}

export function miniAppKeyboard(): InlineKeyboard | undefined {
    const url = getMiniAppUrl();
    if (!url) return undefined;
    return new InlineKeyboard().url('🛒 Открыть магазин', url);
}
