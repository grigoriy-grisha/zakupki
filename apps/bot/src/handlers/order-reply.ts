import type { CustomContext } from '../domain/types';
import { isOrderCollectionChat } from '../lib/telegram-chat';
import { miniAppKeyboard } from '../lib/mini-app';
import { OrderCollectionService } from '../services/order-collection.service';

function formatQuantity(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}

function buildOrderReplyText(result: {
    productName: string;
    quantity: number;
    unitShort: string;
    amountDue: number;
    purchaseTag: string;
    added?: number;
    subtracted?: number;
    cancelled?: boolean;
}): string {
    const lines = [`✅ ${result.productName}`];

    if (result.added) {
        lines.push(`+${formatQuantity(result.added)} ${result.unitShort}`);
    }
    if (result.subtracted) {
        lines.push(`−${formatQuantity(result.subtracted)} ${result.unitShort}`);
    }

    if (result.cancelled) {
        lines.push('Заказ отменён');
    } else {
        lines.push(
            `Всего: ${formatQuantity(result.quantity)} ${result.unitShort} · ${result.amountDue.toLocaleString('ru-RU')} ₽`,
        );
    }

    lines.push(`Закупка ${result.purchaseTag}`);
    return lines.join('\n');
}

export async function orderReplyHandler(ctx: CustomContext) {
    const message = ctx.message;
    if (!message || !('text' in message) || !message.text) return;
    if (!ctx.chat || !ctx.from || ctx.from.is_bot) return;

    const replyTo = message.reply_to_message;
    if (!replyTo) return;

    if (!isOrderCollectionChat(ctx.chat.id, replyTo)) {
        return;
    }

    const service = new OrderCollectionService(ctx.db);
    const result = await service.collectFromReply({
        chatId: ctx.chat.id,
        replyTo,
        text: message.text,
        telegramId: String(ctx.from.id),
        userInfo: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
        },
    });

    if (!result.ok) {
        console.warn(
            `[order] Failed for user ${ctx.from.id} in chat ${ctx.chat.id}: ${result.reason} — ${result.message}`,
        );
        await ctx.reply(result.message, { reply_parameters: { message_id: message.message_id } });
        return;
    }

    console.log(
        `[order] Saved: user ${ctx.from.id}, ${result.productName}, total ${result.quantity} ${result.unitShort}`,
    );

    await ctx.reply(buildOrderReplyText(result), {
        reply_parameters: { message_id: message.message_id },
        reply_markup: miniAppKeyboard(),
    });
}
