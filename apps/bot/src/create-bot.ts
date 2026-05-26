import { Bot, GrammyError, HttpError, session, type BotConfig } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { HttpsProxyAgent } from 'https-proxy-agent';

import type { CreateBotOptions, CustomContext, SessionData } from './lib/types';
import { initMiddleware, requireAuth } from './middlewares';
import { startCommand, helpCommand, ordersCommand, paymentsCommand } from './handlers';

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

    bot.api.config.use(autoRetry());

    bot.use(
        session({
            initial: (): SessionData => ({}),
        }),
    );

    bot.use(initMiddleware(db));

    bot.command('start', startCommand);
    bot.command('help', helpCommand);

    const auth = requireAuth();
    bot.command('orders', auth, ordersCommand);
    bot.command('payments', auth, paymentsCommand);

    bot.on('message:text', async (ctx) => {
        await ctx.reply('Используйте /start чтобы открыть магазин.');
    });

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
