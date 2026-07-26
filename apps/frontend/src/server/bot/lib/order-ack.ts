import { GrammyError } from 'grammy';

import type { CustomContext } from '../domain/types';
import { log } from './logger';

/**
 * Реакции для подтверждения принятого заказа. Telegram-реакции — это не текст
 * сообщения, а отдельный API (`setMessageReaction`), поэтому эмодзи здесь
 * остаются (в отличие от текстов сообщений, где мы их вычистили).
 */
const ACK_REACTIONS = ['❤', '👍', '🎉'] as const;

function describeError(err: unknown): string {
    if (err instanceof GrammyError) return `${err.error_code}: ${err.description}`;
    if (err instanceof Error) return err.message;
    return String(err);
}

/** Подтверждение принятого заказа — реакция на сообщение пользователя. */
export async function reactOrderAccepted(ctx: CustomContext): Promise<void> {
    const message = ctx.message;
    if (!message) {
        log.warn('reactOrderAccepted: no message in context');
        return;
    }

    for (const emoji of ACK_REACTIONS) {
        try {
            await ctx.react(emoji);
            log.debug({ emoji, messageId: message.message_id }, 'reaction set');
            return;
        } catch (err) {
            log.warn({ emoji, messageId: message.message_id, error: describeError(err) }, 'ctx.react failed');
        }
    }

    // Все реакции упали — пишем короткое текстовое подтверждение без эмодзи.
    try {
        await ctx.reply('Заказ принят. Ваши заказы: /orders', {
            reply_parameters: { message_id: message.message_id },
            disable_notification: true,
        });
        log.warn({ messageId: message.message_id }, 'sent text ack fallback');
    } catch (err) {
        log.error({ err, messageId: message.message_id }, 'ack failed');
    }
}
