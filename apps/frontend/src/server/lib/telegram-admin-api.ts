import { Api } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

let cached: Api | null = null;

/**
 * Ленивый Telegram Api для серверных сервисов вне бота (синхронные операции из
 * админки: удалить пост канала и т.п.). Бот поднимается отдельно через
 * instrumentation и может быть выключен, поэтому второй лёгкий инстанс —
 * осознанный выбор, а не дублирование.
 */
export function getTelegramAdminApi(): Api | null {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) return null;
    if (!cached) {
        const proxy = process.env.TELEGRAM_PROXY?.trim();
        cached = new Api(
            token,
            proxy
                ? { baseFetchConfig: { agent: new HttpsProxyAgent(proxy), compress: true } }
                : {},
        );
    }
    return cached;
}
