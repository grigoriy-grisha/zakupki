import type { ServiceContainer } from '../../container/service-container';
import type { CommandHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { paymentsCancelKeyboard, paymentsListText } from '../../lib/payment-texts';

export class PaymentsCommand implements CommandHandler {
    readonly command = 'payments';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        const userId = ctx.session.userId!;
        const { payments, lines } = await this.container.paymentService.getUserPayments(userId);

        await ctx.reply(paymentsListText(payments.length, lines), {
            reply_markup: paymentsCancelKeyboard(payments),
        });
    }
}
