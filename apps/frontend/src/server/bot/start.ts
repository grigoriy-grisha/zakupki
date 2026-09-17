import { createLogger } from '@zakupki/logger';

import { BOT_COMMANDS } from './config/bot-commands';
import { BotConfig, setActiveBotConfig } from './config/bot-config';
import { ServiceContainer } from './container/service-container';
import { createBot } from './create-bot';

const log = createLogger('bot');

export async function startBot() {
    const cfg = new BotConfig();
    if (!cfg.bot.enabled) {
        log.warn('BOT_TOKEN not set — bot disabled');
        return;
    }

    setActiveBotConfig(cfg);

    const container = new ServiceContainer(cfg);
    const bot = createBot(
        { token: cfg.telegram.token, proxyUrl: cfg.telegram.proxyUrl ?? undefined },
        container,
    );

    container.initBotApi(bot.api);
    await container.init();

    if (cfg.telegram.ordersChatId) {
        log.info({ ordersChatId: cfg.telegram.ordersChatId }, 'order collection enabled');
    } else {
        log.warn('TG_ORDERS_CHAT_ID not set — order collection from chat disabled');
    }

    await bot.api.setMyCommands(BOT_COMMANDS);

    bot.start({
        onStart: (info) =>
            log.info(`bot started (long-polling): @${info.username} «${info.first_name}»`),
    });
}
