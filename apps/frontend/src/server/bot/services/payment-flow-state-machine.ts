import type { CustomContext, PaymentFlow, PaymentFlowStep, PromoCodeApplied } from '../domain/types';

/**
 * Тонкая обёртка над `ctx.session.paymentFlow`.
 *
 * Инкапсулирует все мутации payment flow в одном месте, чтобы handler'ы
 * (PayCommand, PaymentAmountHandler, PaymentPromoHandler, PaymentProofHandler,
 * CancelPaymentCommand) не дублировали session-логику.
 *
 * НЕ бросает ошибок — handler сам решает, что отвечать пользователю при
 * невалидном состоянии (например, истёкшая сессия).
 *
 * Шаги: amount → promo → proof. Шаг `promo` опциональный — пользователь может
 * нажать «Продолжить без промокода» и пройти сразу в proof.
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

    /** Применённый промокод (если есть) — читается proof-хендлером при сабмите. */
    get promo(): PromoCodeApplied | undefined {
        return this.ctx.session.paymentFlow?.promoCode;
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
     * Стартует flow с шага promo и сразу выставленной суммой.
     * Используется при `pay:all:{id}` — сумма известна (= remaining), но
     * сначала предлагаем ввести промокод, а потом уже чек.
     */
    startPromoStep(purchaseId: number, purchaseTag: string, remaining: number, amount: number): void {
        this.ctx.session.paymentFlow = {
            step: 'promo',
            purchaseId,
            purchaseTag,
            remaining,
            amount,
        };
    }

    /**
     * Переход amount → promo после того, как пользователь ввёл сумму.
     * Ничего не делает, если flow не активен или не на шаге amount.
     */
    advanceToPromo(amount: number): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        flow.amount = amount;
        flow.step = 'promo';
        this.ctx.session.paymentFlow = flow;
    }

    /**
     * Переход promo → proof с опциональным сохранением валидного промокода.
     * Сумма уже выставлена на шаге amount/promo. Ничего не делает, если flow
     * не активен.
     */
    advanceToProof(promo?: PromoCodeApplied): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        if (promo) {
            flow.promoCode = promo;
            flow.amount = promo.finalAmount;
        }
        flow.step = 'proof';
        this.ctx.session.paymentFlow = flow;
    }

    /** Сбрасывает flow (отмена, успешная отправка, ошибка). */
    clear(): void {
        delete this.ctx.session.paymentFlow;
    }
}
