import type { ServiceContainer } from '../../container/service-container';
import type { CommandHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import type { PaymentFlowStateMachine } from '../../services/payment-flow-state-machine';

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
            await ctx.reply('Оплата отменена.');
            return;
        }
        await ctx.reply('Сейчас нечего отменять.');
    }
}
