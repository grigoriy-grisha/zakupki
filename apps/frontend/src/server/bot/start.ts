import { createLogger } from '@zakupki/logger';

import { BotConfig, setActiveBotConfig } from './config/bot-config';
import { BOT_COMMANDS } from './config/bot-commands';
import { ServiceContainer } from './container/service-container';
import { createBot } from './create-bot';

const log = createLogger('bot');

export async function startBot() {
    const cfg = new BotConfig();
    if (!cfg.bot.enabled) {
        log.warn('BOT_TOKEN not set — bot disabled');
        return;
    }

    // Регистрируем активный config для legacy helpers (getChannelIdFromEnv и т.д.)
    setActiveBotConfig(cfg);

    // Создаём контейнер ДО createBot — createBot не нуждается в контейнере,
    // но ServiceContainer.init() вызывается уже после Bot construction.
    const container = new ServiceContainer(cfg);
    const bot = createBot(
        { token: cfg.telegram.token, proxyUrl: cfg.telegram.proxyUrl ?? undefined },
        container,
    );

    // Сначала привязываем api к контейнеру, потом инициализируем (ChannelDiscussion
    // + TgPostWorker). Без этого воркер может подхватить джобу в первые 1-2s,
    // пока linkedDiscussionChatId === null, и комментарии пропадут.
    container.initBotApi(bot.api);
    await container.init();

    if (cfg.telegram.ordersChatId) {
        log.info({ ordersChatId: cfg.telegram.ordersChatId }, 'order collection enabled');
    } else {
        log.warn('TG_ORDERS_CHAT_ID not set — order collection from chat disabled');
    }

    await bot.api.setMyCommands(BOT_COMMANDS);

    bot.start({ onStart: (info) => log.info({ username: info.username }, 'bot started (long-polling)') });
}
