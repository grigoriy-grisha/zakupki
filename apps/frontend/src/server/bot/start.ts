import { createLogger } from '@zakupki/logger';

import { getOrdersChatIdFromEnv } from './lib/telegram-chat';
import { createBot } from './create-bot';
import { initChannelDiscussion } from './lib/channel-discussion';
import { TgClient } from './lib/tg-client';
import { TgPostWorker } from './services/tg-post-worker';

const log = createLogger('bot');

export async function startBot() {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        log.warn('BOT_TOKEN not set — bot disabled');
        return;
    }

    const bot = createBot({ token: BOT_TOKEN, proxyUrl: process.env.TELEGRAM_PROXY });

    // Сначала инициализируем обсуждение, ПОТОМ стартуем воркер.
    // Без этого воркер может подхватить джобу в первые 1-2s, пока
    // linkedDiscussionChatId === null, и комментарии пропадут.
    await initChannelDiscussion(bot.api);

    new TgPostWorker(new TgClient(bot.api), bot.api).setupWorker();

    const ordersChatId = getOrdersChatIdFromEnv();
    if (ordersChatId) {
        log.info({ ordersChatId }, 'order collection enabled');
    } else {
        log.warn('TG_ORDERS_CHAT_ID not set — order collection from chat disabled');
    }

    await bot.api.setMyCommands([
        { command: 'start', description: 'Открыть магазин' },
        { command: 'help', description: 'Справка' },
        { command: 'orders', description: 'Мои заказы' },
        { command: 'pay', description: 'Отправить чек об оплате' },
        { command: 'payments', description: 'Мои платеты' },
        { command: 'cancel', description: 'Отменить отправку оплаты' },
    ]);

    bot.start({ onStart: (info) => log.info({ username: info.username }, 'bot started (long-polling)') });
}
