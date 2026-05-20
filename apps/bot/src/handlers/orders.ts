import type { CustomContext } from '../types';

export async function ordersCommand(ctx: CustomContext) {
    const userId = ctx.session.userId;
    if (!userId) {
        await ctx.reply('Сначала нажмите /start');
        return;
    }

    const orders = await ctx.db.orderLine.findMany({
        where: { userId },
        include: {
            purchaseItem: {
                include: {
                    product: { include: { unit: true } },
                    purchase: { select: { tag: true, title: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    if (orders.length === 0) {
        await ctx.reply('У вас пока нет заказов.');
        return;
    }

    const lines = orders.map((o) => {
        const product = o.purchaseItem?.product;
        const purchase = o.purchaseItem?.purchase;
        const shortName = product?.unit?.shortName ?? '';
        return (
            `📦 ${product?.name ?? 'Товар'}\n` +
            `   Закупка: ${purchase?.tag ?? '—'} · ${Number(o.quantity).toLocaleString('ru-RU')} ${shortName}\n` +
            `   Сумма: ${Number(o.amountDue).toLocaleString('ru-RU')} ₽`
        );
    });

    const total = orders.reduce((s, o) => s + Number(o.amountDue), 0);
    await ctx.reply(
        `Ваши заказы (последние ${orders.length}):\n\n` +
        lines.join('\n\n') +
        `\n\n💰 Итого: ${total.toLocaleString('ru-RU')} ₽`,
    );
}
