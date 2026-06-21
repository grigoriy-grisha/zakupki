import type { CustomContext } from '../domain/types';
import type { PaymentFlow, PaymentFlowStep } from '../domain/types';

/**
 * Тонкая обёртка над `ctx.session.paymentFlow`.
 *
 * Инкапсулирует все мутации payment flow в одном месте, чтобы handler'ы
 * (PayCommand, PaymentAmountHandler, PaymentProofHandler, CancelPaymentCommand)
 * не дублировали session-логику.
 *
 * НЕ бросает ошибок — handler сам решает, что отвечать пользователю при
 * невалидном состоянии (например, истёкшая сессия).
 */
export class PaymentFlowStateMachine {
    constructor(private readonly ctx: CustomContext) {}

    get isActive(): boolean {
        return this.ctx.session.paymentFlow != null;
    }

    get current(): PaymentFlow | undefined {
        return this.ctx.session.paymentFlow;
    }

    get currentStep(): PaymentFlowStep | undefined {
        return this.ctx.session.paymentFlow?.step;
    }

    /**
     * Стартует flow с шага amount.
     */
    startAmountStep(purchaseId: number, purchaseTag: string, remaining: number): void {
        this.ctx.session.paymentFlow = {
            step: 'amount',
            purchaseId,
            purchaseTag,
            remaining,
        };
    }

    /**
     * Стартует flow с шага proof и сразу выставленной суммой.
     * Используется при `pay:all:{id}`.
     */
    startProofStep(purchaseId: number, purchaseTag: string, remaining: number, amount: number): void {
        this.ctx.session.paymentFlow = {
            step: 'proof',
            purchaseId,
            purchaseTag,
            remaining,
            amount,
        };
    }

    /**
     * Переход amount → proof после того, как пользователь ввёл сумму.
     * Ничего не делает, если flow не активен или уже на proof.
     */
    advanceToProof(amount: number): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        flow.amount = amount;
        flow.step = 'proof';
        this.ctx.session.paymentFlow = flow;
    }

    /** Сбрасывает flow (отмена, успешная отправка, ошибка). */
    clear(): void {
        delete this.ctx.session.paymentFlow;
    }
}
