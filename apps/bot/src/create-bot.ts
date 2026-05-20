import type { PrismaClient } from '@zakupki/database';
import { Bot, GrammyError, HttpError, session } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';

import type { CustomContext } from './types';
import { initMiddleware } from './middlewares';
import { startCommand, helpCommand, ordersCommand, paymentsCommand } from './handlers';

interface CreateBotOptions {
    db: PrismaClient;
    token: string;
}

export function createBot({ db, token }: CreateBotOptions) {
    const bot = new Bot<CustomContext>(token);

    // Auto-retry on 429 flood errors
    bot.api.config.use(autoRetry());

    // Session (in-memory for dev, swap to Redis/DB for prod)
    bot.use(
        session({
            initial: (): SessionData => ({}),
        }),
    );

    // Init middleware: attach db, upsert user
    bot.use(initMiddleware(db));

    // Commands
    bot.command('start', startCommand);
    bot.command('help', helpCommand);
    bot.command('orders', ordersCommand);
    bot.command('payments', paymentsCommand);

    // Fallback
    bot.on('message:text', async (ctx) => {
        await ctx.reply('Используйте /start чтобы открыть магазин.');
    });

    // Error handling
    bot.catch((err) => {
        const ctx = err.ctx;
        console.error(`Error while handling update ${ctx.update.update_id}:`);
        const e = err.error;
        if (e instanceof GrammyError) {
            console.error('GrammyError:', e.description);
        } else if (e instanceof HttpError) {
            console.error('HttpError:', e);
        } else {
            console.error('Unknown error:', e);
        }
    });

    return bot;
}

import type { SessionData } from './types';
