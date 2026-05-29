import 'dotenv/config';

import { dbClient } from '@zakupki/database';
import { getRedisConnection } from '@zakupki/queue';

import { createBot } from './create-bot';
import { setupPurchaseChannelPostHandler } from './notifications/purchase-channel-post.handler';
import { getOrdersChatIdFromEnv } from './lib/telegram-chat';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');

const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY;

async function main() {
    await dbClient.$connect();
    console.log('Database connected');

    const bot = createBot({
        db: dbClient,
        token: BOT_TOKEN!,
        proxyUrl: TELEGRAM_PROXY,
    });

    setupPurchaseChannelPostHandler(bot, { redis: getRedisConnection(), db: dbClient });

    const ordersChatId = getOrdersChatIdFromEnv();
    if (ordersChatId) {
        console.log(`[bot] Order collection enabled for chat ${ordersChatId}`);
    } else {
        console.warn('[bot] TG_ORDERS_CHAT_ID не задан — сбор заявок из чата отключён');
    }

    await bot.api.setMyCommands([
        { command: 'start', description: 'Открыть магазин' },
        { command: 'help', description: 'Справка' },
        { command: 'orders', description: 'Мои заказы' },
        { command: 'payments', description: 'Мои оплаты' },
    ]);

    await bot.start({
        onStart: (info) => console.log(`Bot @${info.username} started`),
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        console.log(`\n${signal} received, shutting down...`);
        await bot.stop();
        await dbClient.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
