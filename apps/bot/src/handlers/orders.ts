import type { CustomContext } from '../domain/types';
import { OrderService } from '../services/order.service';

export async function ordersCommand(ctx: CustomContext) {
    const userId = ctx.session.userId!;
    const orderService = new OrderService(ctx.db);

    const { orders, lines, total } = await orderService.getUserOrders(userId);

    if (orders.length === 0) {
        await ctx.reply('У вас пока нет заказов.');
        return;
    }

    await ctx.reply(
        `Ваши заказы (последние ${orders.length}):\n\n` +
            lines.join('\n\n') +
            `\n\n💰 Итого: ${total.toLocaleString('ru-RU')} ₽`,
    );
}
