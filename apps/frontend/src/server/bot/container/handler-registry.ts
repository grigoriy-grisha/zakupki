import type { Bot, MiddlewareFn } from 'grammy';
import { createLogger } from '@zakupki/logger';

import type { CustomContext } from '../domain/types';
import type { ServiceContainer } from './service-container';
import { CallbackDispatcher } from '../domain/callback-dispatcher';
import { AuthGuard } from '../middlewares/auth';
import type { CallbackHandler, CommandHandler, MessageHandler } from '../domain/handler';

const log = createLogger('handler-registry');

/**
 * HandlerRegistry — единая точка регистрации всех хендлеров бота.
 *
 * Phase G: используется в `create-bot.ts`. Заменяет ручную регистрацию
 * `bot.command/callbackQuery/on`.
 *
 * Auth: каждый handler декларирует `requireAuth: boolean`. Registry сам оборачивает
 * `bot.command`/`bot.callbackQuery` в AuthGuard при необходимости.
 */
export class HandlerRegistry {
    readonly container: ServiceContainer;

    private readonly commandHandlers: CommandHandler[] = [];
    private readonly callbackHandlers: CallbackHandler[] = [];
    private readonly messageHandlers: MessageHandler[] = [];

    constructor(container: ServiceContainer) {
        this.container = container;
    }

    addCommand(handler: CommandHandler): this {
        this.commandHandlers.push(handler);
        return this;
    }

    addCallback(handler: CallbackHandler): this {
        this.callbackHandlers.push(handler);
        return this;
    }

    addMessage(handler: MessageHandler): this {
        this.messageHandlers.push(handler);
        return this;
    }

    /** Регистрирует все хендлеры на переданный bot. */
    registerOn(bot: Bot<CustomContext>): void {
        const auth = new AuthGuard().middleware();

        for (const handler of this.commandHandlers) {
            const wrapped: MiddlewareFn<CustomContext>[] = handler.requireAuth
                ? [auth, (ctx) => handler.handle(ctx)]
                : [(ctx) => handler.handle(ctx)];
            bot.command(handler.command, ...wrapped);
            log.debug({ command: handler.command, requireAuth: handler.requireAuth }, 'command registered');
        }

        if (this.callbackHandlers.length > 0) {
            const dispatcher = new CallbackDispatcher(this.callbackHandlers);
            for (const prefix of dispatcher.prefixes()) {
                const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`^${escaped}`);
                // Каждый callback handler может требовать auth — для простоты считаем,
                // что ВСЕ callback'и требуют auth (orders и pay оба так делают).
                bot.callbackQuery(regex, auth, (ctx) => dispatcher.dispatch(ctx));
                log.debug({ prefix }, 'callback registered');
            }
        }

        for (const handler of this.messageHandlers) {
            this.registerMessageHandler(bot, handler, auth);
            log.debug({ filter: handler.filter, requireAuth: handler.requireAuth }, 'message handler registered');
        }
    }

    // ── Private ────────────────────────────────────────────────────
    private registerMessageHandler(
        bot: Bot<CustomContext>,
        handler: MessageHandler,
        auth: MiddlewareFn<CustomContext>,
    ): void {
        const apply = (ctx: CustomContext, next: () => Promise<void>) => handler.handle(ctx, next);

        switch (handler.filter) {
            case 'photo_or_doc':
                bot.on(['message:photo', 'message:document'], ...(handler.requireAuth ? [auth, apply] : [apply]));
                return;
            case 'text_with_payment_flow':
                bot.on('message:text', ...(handler.requireAuth ? [auth, apply] : [apply]));
                return;
            case 'autoforward':
                bot.on(
                    'message:is_automatic_forward',
                    ...(handler.requireAuth ? [auth, apply] : [apply]),
                );
                return;
            case 'order_reply':
                bot.on('message:text', apply);
                return;
            case 'fallback_text':
                bot.on('message:text', apply);
                return;
        }
    }
}
