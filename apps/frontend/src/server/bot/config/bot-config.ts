import { BotError } from '../errors/bot-error';
import { normalizeChatId } from '../lib/telegram-post';

/**
 * Конфигурация Telegram-бота.
 *
 * Читает env один раз при инстанцировании. Не вычитывает process.env в каждом методе.
 *
 * Только `telegram.token` — обязательный для старта бота. Остальные переменные
 * опциональны: их отсутствие gracefully отключает соответствующий функционал
 * (посты в канал, order collection, webapp-кнопки).
 */
export class BotConfig {
    readonly bot: { enabled: boolean };

    readonly telegram: {
        token: string;
        proxyUrl: string | null;
        ordersChatId: string | null;
        channelId: string | null;
    };

    readonly webapp: {
        url: string | null;
        miniAppUrl: string | null;
        photoBaseUrl: string | null;
    };

    constructor(env: NodeJS.ProcessEnv = process.env) {
        const token = env.BOT_TOKEN?.trim() ?? '';
        this.bot = { enabled: token.length > 0 };

        const proxy = env.TELEGRAM_PROXY?.trim();
        const ordersRaw = (env.TG_ORDERS_CHAT_ID ?? env.TELEGRAM_ORDERS_CHAT_ID)?.trim();
        const channelRaw = (env.TELEGRAM_CHANNEL_ID ?? env.TG_CHANNEL_ID)?.trim();
        const webappRaw = env.WEBAPP_URL?.trim();
        const miniAppRaw = env.TELEGRAM_MINI_APP_URL?.trim();

        this.telegram = {
            token,
            proxyUrl: proxy ? proxy : null,
            ordersChatId: ordersRaw ? normalizeChatId(ordersRaw) : null,
            channelId: channelRaw ? normalizeChatId(channelRaw) : null,
        };

        this.webapp = {
            url: webappRaw ? webappRaw.replace(/\/$/, '') : null,
            miniAppUrl: miniAppRaw ? miniAppRaw : null,
            photoBaseUrl: webappRaw ? webappRaw.replace(/\/$/, '') : null,
        };
    }

    /**
     * Проверяет, что обязательные переменные заданы. Бросает BotError со списком
     * всех недостающих переменных разом (а не fail-fast на первой).
     */
    assertValid(): void {
        if (!this.bot.enabled) {
            throw new BotError('CONFIG_INVALID', 'BOT_TOKEN is required to start the bot');
        }
    }
}

// ── Module-level singleton — единый источник правды для legacy helpers ──
let _activeConfig: BotConfig | null = null;

export function setActiveBotConfig(cfg: BotConfig): void {
    _activeConfig = cfg;
}

export function getActiveBotConfig(): BotConfig {
    if (!_activeConfig) {
        // Fallback: создать из process.env. Не идеально, но позволяет legacy
        // helpers (`getChannelIdFromEnv`) работать до того, как ServiceContainer
        // инициализирован (например, при тестах).
        _activeConfig = new BotConfig();
    }
    return _activeConfig;
}
