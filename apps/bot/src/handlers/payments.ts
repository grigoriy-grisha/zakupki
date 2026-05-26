import type { CustomContext } from '../lib/types';

const PAYMENT_STATUS: Record<string, { emoji: string; label: string }> = {
    PENDING:  { emoji: '⏳', label: 'Ожидает проверки' },
    CONFIRMED: { emoji: '✅', label: 'Подтверждено' },
    REJECTED: { emoji: '❌', label: 'Отклонено' },
};

export async function paymentsCommand(ctx: CustomContext) {
    const userId = ctx.session.userId!;

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

    const lines = payments.map((p) => {
        const childAmount = (p.children ?? []).reduce((s, c) => s + Number(c.amount), 0);
        const total = Number(p.amount) + childAmount;
        const { emoji = '❓', label = p.status } = PAYMENT_STATUS[p.status] ?? {};
        return (
            `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
            `   ${label} · ${new Date(p.paidAt).toLocaleDateString('ru-RU')}`
        );
    });

    await ctx.reply(
        `Ваши оплаты (последние ${payments.length}):\n\n` +
        lines.join('\n\n'),
    );
}
