import type { CustomContext } from '../../domain/types';
import { PaymentFlowStateMachine } from '../../services/payment-flow-state-machine';
import type { CommandHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';

/**
 * /cancel — отменяет активный payment flow.
 */
export class CancelPaymentCommand implements CommandHandler {
    readonly command = 'cancel';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        const flow: PaymentFlowStateMachine = this.container.flowFor(ctx);
        if (flow.isActive) {
            flow.clear();
            await ctx.reply('Отправка оплаты отменена.');
            return;
        }
        await ctx.reply('Нет активной отправки оплаты.');
    }
}
