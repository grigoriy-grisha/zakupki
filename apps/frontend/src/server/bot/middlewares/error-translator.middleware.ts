import { GrammyError, HttpError, type NextFunction } from 'grammy';
import { createLogger } from '@zakupki/logger';

import type { CustomContext } from '../domain/types';
import type { ServiceContainer } from '../container/service-container';
import { BotError } from '../errors/bot-error';

const log = createLogger('bot-error-translator');

/**
 * Middleware: ловит ошибки в handler pipeline и переводит их в user-friendly
 * сообщения на русском.
 *
 * Логика:
 *  - `BotError` (и подклассы) → `ctx.reply(err.message)` (или `answerCallbackQuery`
 *    для callback-запросов). Это Russian text, заданный на throw site.
 *  - Любая другая `Error` → логируем stack, отправляем generic "Что-то пошло не так".
 *  - GrammyError / HttpError → пробрасываем дальше (их ловит bot.catch).
 *
 * Подключается в create-bot.ts в Phase G. В Phase B — dormant (класс готов,
 * но не зарегистрирован).
 */
export class ErrorTranslatorMiddleware {
    constructor(private readonly container: ServiceContainer) {}

    middleware() {
        return async (ctx: CustomContext, next: NextFunction): Promise<void> => {
            try {
                await next();
            } catch (err) {
                await this.translate(ctx, err);
            }
        };
    }

    private async translate(ctx: CustomContext, err: unknown): Promise<void> {
        // Не наша ошибка — пусть grammY её логирует в bot.catch
        if (err instanceof GrammyError || err instanceof HttpError) {
            throw err;
        }

        if (err instanceof BotError) {
            if (ctx.callbackQuery) {
                await ctx.answerCallbackQuery({ text: err.message, show_alert: true }).catch(() => undefined);
            } else {
                await ctx.reply(err.message).catch(() => undefined);
            }
            return;
        }

        // Неизвестная ошибка
        log.error(
            {
                updateId: ctx.update.update_id,
                err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
            },
            'unhandled error in handler pipeline',
        );

        const generic = 'Что-то пошло не так. Попробуйте позже.';
        if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ text: generic, show_alert: true }).catch(() => undefined);
        } else {
            await ctx.reply(generic).catch(() => undefined);
        }
    }
}
