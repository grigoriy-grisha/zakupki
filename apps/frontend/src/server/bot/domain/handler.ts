import type { NextFunction } from 'grammy';

import type { CustomContext } from './types';
import type { CallbackAction } from './callback-data';

/**
 * Унифицированные интерфейсы для всех хендлеров бота.
 *
 * Цель: HandlerRegistry.registerOn(bot) — единая точка регистрации.
 * Каждый хендлер — класс с чёткой ответственностью.
 *
 * command:    `bot.command('foo', handler.handle)`
 * callback:   `bot.callbackQuery(/^<prefix>:/, dispatcher.dispatch)` — диспатчер
 *             парсит action и зовёт `handler.handle(ctx, action)`.
 * message:    `bot.on(<filter>, handler.handle)` — handler сам решает, звать ли next().
 */

export interface CommandHandler {
    /** Имя команды (например, 'start', 'orders'). */
    readonly command: string;
    /** Требуется ли requireAuth middleware перед handler. */
    readonly requireAuth: boolean;
    handle(ctx: CustomContext): Promise<void>;
}

export interface CallbackHandler {
    /** Префикс callback-data (например, 'orders:', 'pay:'). */
    readonly prefix: string;
    readonly requireAuth: boolean;
    handle(ctx: CustomContext, action: CallbackAction): Promise<void>;
}

/** Фильтр сообщений для MessageHandler. */
export type MessageFilter =
    | 'photo_or_doc' // photo или document
    | 'text_with_payment_flow' // текст с активным payment flow (или без — handler вызовет next)
    | 'autoforward' // is_automatic_forward
    | 'order_reply' // текст в order collection chat
    | 'fallback_text'; // последний catch-all текст

export interface MessageHandler {
    readonly filter: MessageFilter;
    readonly requireAuth: boolean;
    /** `next` нужен для фильтров, которые могут пропускать событие дальше. */
    handle(ctx: CustomContext, next: NextFunction): Promise<void>;
}
