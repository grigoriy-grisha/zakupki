import { getRedisConnection } from '@zakupki/queue';

import { createBot } from './create-bot';
import { initChannelDiscussion } from './lib/channel-discussion';
import { setupPurchaseChannelPostHandler } from './notifications/purchase-channel-post.handler';
import { getOrdersChatIdFromEnv } from './lib/telegram-chat';

export async function startBot() {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.warn('[bot] BOT_TOKEN not set — bot disabled');
        return;
    }

    const bot = createBot({ token: BOT_TOKEN, proxyUrl: process.env.TELEGRAM_PROXY });

    setupPurchaseChannelPostHandler(bot, { redis: getRedisConnection() });

    await initChannelDiscussion(bot.api);

    const ordersChatId = getOrdersChatIdFromEnv();
    if (ordersChatId) {
        console.log(`[bot] Order collection enabled for chat ${ordersChatId}`);
    } else {
        console.warn('[bot] TG_ORDERS_CHAT_ID not set — order collection from chat disabled');
    }

    await bot.api.setMyCommands([
        { command: 'start', description: 'Открыть магазин' },
        { command: 'help', description: 'Справка' },
        { command: 'orders', description: 'Мои заказы' },
        { command: 'pay', description: 'Отправить чек об оплате' },
        { command: 'payments', description: 'Мои оплаты' },
        { command: 'cancel', description: 'Отменить отправку оплаты' },
    ]);

    bot.start({ onStart: (info) => console.log(`Bot @${info.username} started`) });

    console.log('[bot] Telegram bot started (long-polling)');
}
