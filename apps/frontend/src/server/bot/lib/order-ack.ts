import { GrammyError } from 'grammy';

import type { CustomContext } from '../domain/types';

/** Grammy типизирует стандартный набор; ❤ — красное сердце в Telegram. */
const ACK_REACTIONS = ['❤', '👍', '🎉'] as const;

function formatApiError(err: unknown): string {
    if (err instanceof GrammyError) {
        return `${err.error_code}: ${err.description}`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

/** Подтверждение принятого заказа — реакция на сообщение пользователя. */
export async function reactOrderAccepted(ctx: CustomContext): Promise<void> {
    const message = ctx.message;
    if (!message) {
        console.warn('[order] reactOrderAccepted: no message in context');
        return;
    }

    for (const emoji of ACK_REACTIONS) {
        try {
            await ctx.react(emoji);
            console.log(`[order] Reaction ${emoji} on message ${message.message_id}`);
            return;
        } catch (err) {
            console.warn(`[order] ctx.react(${emoji}): ${formatApiError(err)}`);
        }
    }

    try {
        await ctx.reply('❤️', {
            reply_parameters: { message_id: message.message_id },
            disable_notification: true,
        });
        console.warn(`[order] Sent ❤️ reply fallback for message ${message.message_id}`);
    } catch (err) {
        console.error('[order] Ack failed:', formatApiError(err));
    }
}
