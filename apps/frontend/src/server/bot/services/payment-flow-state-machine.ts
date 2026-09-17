import type { CustomContext, PaymentFlow, PaymentFlowStep, PromoCodeApplied } from '../domain/types';

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

    get promo(): PromoCodeApplied | undefined {
        return this.ctx.session.paymentFlow?.promoCode;
    }

    startAmountStep(purchaseId: number, purchaseTag: string, available: number): void {
        this.ctx.session.paymentFlow = {
            step: 'amount',
            purchaseId,
            purchaseTag,
            available,
        };
    }

    startPromoStep(purchaseId: number, purchaseTag: string, available: number, amount: number): void {
        this.ctx.session.paymentFlow = {
            step: 'promo',
            purchaseId,
            purchaseTag,
            available,
            amount,
        };
    }

    advanceToPromo(amount: number): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        flow.amount = amount;
        flow.step = 'promo';
        this.ctx.session.paymentFlow = flow;
    }

    advanceToProof(promo?: PromoCodeApplied): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        if (promo) {
            flow.promoCode = promo;
        }
        flow.step = 'proof';
        this.ctx.session.paymentFlow = flow;
    }

    clear(): void {
        delete this.ctx.session.paymentFlow;
    }
}
