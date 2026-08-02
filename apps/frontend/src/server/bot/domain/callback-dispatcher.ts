import type { CallbackHandler, CommandHandler, MessageHandler } from './handler';
import { CallbackParser } from './callback-data';
import type { CustomContext } from './types';

/**
 * Маршрутизатор callback-запросов. Парсит `ctx.callbackQuery.data` через
 * `CallbackParser.parse`, находит handler по префиксу и вызывает `handle(ctx, action)`.
 *
 * Если parse падает — отвечает alertCallbackQuery с "Некорректный запрос" и не зовёт handler.
 */
export class CallbackDispatcher {
    private readonly byPrefix: Map<string, CallbackHandler>;

    constructor(handlers: CallbackHandler[]) {
        this.byPrefix = new Map();
        for (const h of handlers) this.byPrefix.set(h.prefix, h);
    }

    /** Префиксы для регистрации в grammY: каждый → `bot.callbackQuery(/^<prefix>/, ...)`. */
    prefixes(): string[] {
        return Array.from(this.byPrefix.keys());
    }

    async dispatch(ctx: CustomContext): Promise<void> {
        const data = ctx.callbackQuery?.data;
        if (!data) {
            await ctx.answerCallbackQuery({ text: 'Некорректный запрос' }).catch(() => undefined);
            return;
        }

        // Префикс — это `prefix:` (например, 'orders:'). Ищем по startsWith.
        let matchedKey: string | null = null;
        for (const key of this.byPrefix.keys()) {
            if (data.startsWith(key)) {
                matchedKey = key;
                break;
            }
        }
        if (!matchedKey) {
            await ctx.answerCallbackQuery({ text: 'Некорректный запрос' }).catch(() => undefined);
            return;
        }

        const action = CallbackParser.parse(data);
        if (!action) {
            await ctx.answerCallbackQuery({ text: 'Некорректный запрос' }).catch(() => undefined);
            return;
        }

        await this.byPrefix.get(matchedKey)!.handle(ctx, action);
    }
}

// Re-export часто используемых типов для удобства импорта.
export type { CallbackHandler, CommandHandler, MessageHandler };
