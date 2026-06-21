import type { CustomContext } from '../../domain/types';
import type { CommandHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';

/**
 * /payments — история оплат пользователя.
 */
export class PaymentsCommand implements CommandHandler {
    readonly command = 'payments';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        const userId = ctx.session.userId!;
        const { payments, lines } = await this.container.paymentService.getUserPayments(userId);

        if (payments.length === 0) {
            await ctx.reply('У вас пока нет оплат.');
            return;
        }

        await ctx.reply(`Ваши оплаты (последние ${payments.length}):\n\n` + lines.join('\n\n'));
    }
}
