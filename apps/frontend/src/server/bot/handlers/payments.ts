import type { CustomContext } from '../domain/types';
import { serviceContainer } from '@/server/lib/service-container';

export async function paymentsCommand(ctx: CustomContext) {
    const userId = ctx.session.userId!;

    const { payments, lines } = await serviceContainer.payment.getUserPayments(userId);

    if (payments.length === 0) {
        await ctx.reply('У вас пока нет оплат.');
        return;
    }

    await ctx.reply(`Ваши оплаты (последние ${payments.length}):\n\n` + lines.join('\n\n'));
}
