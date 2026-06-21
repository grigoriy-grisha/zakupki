import { InlineKeyboard } from 'grammy';
import { isPurchasePaymentOpen } from '@zakupki/types';

import type { CustomContext } from '../../domain/types';
import { isPrivateChat } from '../shared/is-private-chat';
import type { CommandHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';

/**
 * /pay — отображает клавиатуру закупок, по которым можно отправить оплату.
 */
export class PayCommand implements CommandHandler {
    readonly command = 'pay';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        if (!isPrivateChat(ctx)) {
            await ctx.reply('Оплату через бота можно отправить только в личных сообщениях.');
            return;
        }

        const userId = ctx.session.userId!;
        const payable = await this.container.paymentService.getPayablePurchases(userId);

        if (payable.length === 0) {
            const active = await this.container.orderService.getActivePurchases(userId);
            const waitingPayment = active.filter((p) => !isPurchasePaymentOpen(p.fulfillmentStatus as never));

            if (waitingPayment.length > 0) {
                await ctx.reply(
                    'Сейчас нельзя отправить оплату.\n' +
                        'По вашим закупкам ещё не открыт приём оплаты — следите за статусом в /orders.\n\n' +
                        'Когда наступит этап «Оплата заказов», используйте /pay или кнопку в заказе.',
                );
                return;
            }

            await ctx.reply(
                'Нет закупок, по которым можно отправить оплату.\n' +
                    'Возможно, всё уже оплачено или есть платёж на проверке — см. /payments',
            );
            return;
        }

        const keyboard = new InlineKeyboard();
        for (const p of payable) {
            const label = `${p.tag} — ${p.remaining.toLocaleString('ru-RU')} ₽`;
            keyboard.text(label.slice(0, 60), `pay:pick:${p.purchaseId}`).row();
        }

        await ctx.reply('Выберите закупку для оплаты:', { reply_markup: keyboard });
    }
}
