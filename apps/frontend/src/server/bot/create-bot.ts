import { Bot, GrammyError, HttpError, session, type BotConfig } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { HttpsProxyAgent } from 'https-proxy-agent';

import type { CreateBotOptions, CustomContext, SessionData } from './domain/types';
import { SessionInitMiddleware } from './middlewares/init';
import { AuthGuard } from './middlewares/auth';
import { HandlerRegistry } from './container/handler-registry';
import { isOrderCollectionMessage } from './lib/telegram-chat';
import { log } from './lib/logger';
import type { ServiceContainer } from './container/service-container';

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

/**
 * Создаёт Bot<CustomContext> с базовыми middleware и делегирует регистрацию
 * command/callback/message handlers в `HandlerRegistry`.
 *
 * Pipeline:
 *  1. session() — ctx.session
 *  2. SessionInitMiddleware — инициализация user в session
 *  3. GroupMessageFilter — пропускает только auto-forward / order-reply в группах
 *  4. AuthGuard — для всех auth-требующих хендлеров (через handler.requireAuth)
 *  5. HandlerRegistry — все command/callback/message handlers
 */
export function createBot(
    { token, proxyUrl }: CreateBotOptions,
    container: ServiceContainer,
): Bot<CustomContext> {
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

    bot.use(new SessionInitMiddleware(container).middleware());

    // Group filter: пропускаем только is_automatic_forward и order collection messages
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

    // Регистрация всех handlers через registry
    const registry = new HandlerRegistry(container);
    registry
        // Commands
        .addCommand(new StartCommand())
        .addCommand(new HelpCommand())
        .addCommand(new OrdersCommand(container))
        .addCommand(new PaymentsCommand(container))
        .addCommand(new PayCommand(container))
        .addCommand(new CancelPaymentCommand(container))
        // Callbacks
        .addCallback(new OrdersCallbackQueryHandler(container))
        .addCallback(new PayCallbackQueryHandler(container))
        // Messages
        .addMessage(new ChannelPostShopCommentHandler())
        .addMessage(new PaymentProofHandler(container))
        .addMessage(new PaymentAmountHandler(container))
        .addMessage(new PaymentPromoHandler(container))
        .addMessage(new OrderReplyHandler(container))
        .addMessage(new FallbackTextHandler());

    registry.registerOn(bot);

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

// ── Imports для HandlerRegistry (используются в addCommand/addCallback/addMessage выше) ──
import { StartCommand } from './handlers/command/start.command';
import { HelpCommand } from './handlers/command/help.command';
import { OrdersCommand } from './handlers/command/orders.command';
import { PaymentsCommand } from './handlers/command/payments.command';
import { PayCommand } from './handlers/command/pay.command';
import { CancelPaymentCommand } from './handlers/command/cancel.command';
import { OrdersCallbackQueryHandler } from './handlers/callback/orders.callback';
import { PayCallbackQueryHandler } from './handlers/callback/pay.callback';
import { ChannelPostShopCommentHandler } from './handlers/message/channel-post-comment.handler';
import { PaymentProofHandler } from './handlers/message/payment-proof.handler';
import { PaymentAmountHandler } from './handlers/message/payment-amount.handler';
import { PaymentPromoHandler } from './handlers/message/payment-promo.handler';
import { OrderReplyHandler } from './handlers/message/order-reply.handler';
import { FallbackTextHandler } from './handlers/message/fallback-text.handler';
