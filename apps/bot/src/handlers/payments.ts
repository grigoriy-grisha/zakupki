import type { CustomContext } from '../domain/types';
import { PaymentService } from '../services/payment.service';

export async function paymentsCommand(ctx: CustomContext) {
    const userId = ctx.session.userId!;
    const paymentService = new PaymentService(ctx.db);

    const { payments, lines } = await paymentService.getUserPayments(userId);

    if (payments.length === 0) {
        await ctx.reply('У вас пока нет оплат.');
        return;
    }

    await ctx.reply(`Ваши оплаты (последние ${payments.length}):\n\n` + lines.join('\n\n'));
}
