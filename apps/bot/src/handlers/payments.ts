import type { CustomContext } from '../lib/types';

export async function paymentsCommand(ctx: CustomContext) {
    const userId = ctx.session.userId;
    if (!userId) {
        await ctx.reply('Сначала нажмите /start');
        return;
    }

    const payments = await ctx.db.payment.findMany({
        where: { userId, parentId: null },
        include: {
            purchase: { select: { tag: true, supplier: true } },
            children: { include: { promoCode: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
    });

    if (payments.length === 0) {
        await ctx.reply('У вас пока нет оплат.');
        return;
    }

    const statusEmoji: Record<string, string> = {
        PENDING: '⏳',
        CONFIRMED: '✅',
        REJECTED: '❌',
    };

    const statusLabel: Record<string, string> = {
        PENDING: 'Ожидает проверки',
        CONFIRMED: 'Подтверждено',
        REJECTED: 'Отклонено',
    };

    const lines = payments.map((p) => {
        const childAmount = (p.children ?? []).reduce((s, c) => s + Number(c.amount), 0);
        const total = Number(p.amount) + childAmount;
        const emoji = statusEmoji[p.status] ?? '❓';
        const status = statusLabel[p.status] ?? p.status;
        return (
            `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
            `   ${status} · ${new Date(p.paidAt).toLocaleDateString('ru-RU')}`
        );
    });

    await ctx.reply(
        `Ваши оплаты (последние ${payments.length}):\n\n` +
        lines.join('\n\n'),
    );
}
