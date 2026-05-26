import type { PrismaClient } from '@zakupki/database';
import { Bot, GrammyError, HttpError, session, type BotConfig } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { HttpsProxyAgent } from 'https-proxy-agent';

import type { CustomContext } from './types';
import { initMiddleware } from './middlewares';
import { startCommand, helpCommand, ordersCommand, paymentsCommand } from './handlers';

interface CreateBotOptions {
    db: PrismaClient;
    token: string;
    proxyUrl?: string;
}

function botConfigWithProxy(proxyUrl: string): BotConfig<CustomContext> {
    return {
        client: {
            baseFetchConfig: {
                agent: new HttpsProxyAgent(proxyUrl),
                compress: true,
            },
        },
    };
}

export function createBot({ db, token, proxyUrl }: CreateBotOptions) {
    const proxy = proxyUrl?.trim();
    if (proxy) {
        console.log('[bot] Telegram API via proxy');
    }

    const bot = new Bot<CustomContext>(token, proxy ? botConfigWithProxy(proxy) : undefined);

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
        console.error(err);
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
