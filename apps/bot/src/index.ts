import { dbClient } from '@zakupki/database';

import { createBot } from './create-bot';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');

// BOT_TOKEN is guaranteed to be defined after the check above

async function main() {
    await dbClient.$connect();
    console.log('Database connected');

    const bot = createBot({ db: dbClient, token: BOT_TOKEN! });

    // Set bot commands for Telegram menu
    await bot.api.setMyCommands([
        { command: 'start', description: 'Открыть магазин' },
        { command: 'help', description: 'Справка' },
        { command: 'orders', description: 'Мои заказы' },
        { command: 'payments', description: 'Мои оплаты' },
    ]);

    bot.start();
    console.log('Bot started');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
