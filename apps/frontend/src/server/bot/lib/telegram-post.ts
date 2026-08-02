import { getActiveBotConfig } from '../config/bot-config';

export function normalizeChatId(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('@') || trimmed.startsWith('-')) return trimmed;
    if (/^100\d+$/.test(trimmed)) return `-${trimmed}`;
    return trimmed;
}

/**
 * Возвращает channel id из активной BotConfig.
 *
 * @deprecated В новом коде используйте `container.cfg.telegram.channelId` напрямую.
 * Эта функция оставлена для backward-compat с кодом, который ещё не мигрировал
 * на DI.
 */
export function getChannelIdFromEnv(): string | null {
    return getActiveBotConfig().telegram.channelId;
}
