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
import { log } from './lib/logger';

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
        log.info('Telegram API via proxy');
    }

    const bot = new Bot<CustomContext>(token, proxy ? botConfigWithProxy(proxy) : undefined);

    bot.api.config.use(autoRetry());

    bot.use(
        session({
            initial: (): SessionData => ({}),
        }),
    );

    bot.use(initMiddleware());

    bot.on('message', async (ctx, next) => {
        const chatType = ctx.chat?.type;
        if (chatType === 'group' || chatType === 'supergroup') {
            const isAutoForward = ctx.message?.is_automatic_forward;
            const isOrderReply =
                ctx.message?.reply_to_message && ctx.message.text && isOrderCollectionMessage(ctx.chat.id, ctx.message);
            if (!isAutoForward && !isOrderReply) {
                return;
            }
        }
        await next();
    });

    // Единственный handler на is_automatic_forward — внутри делает и индексацию
    // (для статус-комментариев через reply_parameters), и shop-комментарий.
    // grammY вызывает только ОДИН handler на событие, поэтому дублировать
    // `bot.on('message:is_automatic_forward', ...)` нельзя.
    bot.on('message:is_automatic_forward', channelPostShopCommentHandler);

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

    bot.on('message:text', orderReplyHandler);

    bot.on('message:text', async (ctx) => {
        if (ctx.session.paymentFlow) return;
        if (ctx.message?.is_automatic_forward) return;
        if (ctx.chat && ctx.message && isOrderCollectionMessage(ctx.chat.id, ctx.message)) {
            return;
        }
        await ctx.reply('Используйте /start чтобы открыть магазин.');
    });
    bot.catch((err) => {
        const e = err.error;
        const errorMeta =
            e instanceof GrammyError
                ? { kind: 'GrammyError', description: e.description }
                : e instanceof HttpError
                  ? { kind: 'HttpError', error: e }
                  : { kind: 'Unknown', error: e };
        log.error({ updateId: err.ctx.update.update_id, ...errorMeta }, 'error while handling update');
    });

    return bot;
}
