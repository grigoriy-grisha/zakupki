import { Bot, GrammyError, HttpError, session, type BotConfig } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { HttpsProxyAgent } from 'https-proxy-agent';

import type { CreateBotOptions, CustomContext, SessionData } from './domain/types';
import { initMiddleware, requireAuth } from './middlewares';
import {
    startCommand,
    helpCommand,
    ordersCommand,
    ordersCallbackQuery,
    paymentsCommand,
    payCommand,
    cancelPaymentCommand,
    payCallbackQuery,
    paymentFlowTextHandler,
    paymentProofHandler,
    channelPostShopCommentHandler,
    orderReplyHandler,
} from './handlers';
import { isOrderCollectionMessage } from './lib/telegram-chat';

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

export function createBot({ token, proxyUrl }: CreateBotOptions) {
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

    bot.use(initMiddleware());

    // Заказы в группе — без requireAuth; комментарий к посту — только на автопересылку
    bot.on('message:text', orderReplyHandler);
    bot.on('message', channelPostShopCommentHandler);

    bot.command('start', startCommand);
    bot.command('help', helpCommand);

    const auth = requireAuth();
    bot.command('orders', auth, ordersCommand);
    bot.command('payments', auth, paymentsCommand);
    bot.command('pay', auth, payCommand);
    bot.command('cancel', auth, cancelPaymentCommand);

    bot.callbackQuery(/^orders:/, auth, ordersCallbackQuery);
    bot.callbackQuery(/^pay:/, auth, payCallbackQuery);

    bot.on(['message:photo', 'message:document'], auth, paymentProofHandler);
    bot.on('message:text', auth, paymentFlowTextHandler);

    bot.on('message:text', async (ctx) => {
        if (ctx.session.paymentFlow) return;
        if (ctx.message?.is_automatic_forward) return;
        if (ctx.chat && ctx.message && isOrderCollectionMessage(ctx.chat.id, ctx.message)) {
            return;
        }
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
