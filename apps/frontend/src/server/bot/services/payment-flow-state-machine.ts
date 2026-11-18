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

    /** Сумма и промокод выбраны — дальше контакт для чека (если нужен) или выбор способа оплаты. */
    advanceToCheckout(step: 'contact' | 'method', promo?: PromoCodeApplied): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        if (promo) {
            flow.promoCode = promo;
        }
        flow.step = step;
        this.ctx.session.paymentFlow = flow;
    }

    setReceiptContact(contact: string): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        flow.receiptContact = contact;
        flow.step = 'method';
        this.ctx.session.paymentFlow = flow;
    }

    /** Сбросить выбранный промокод (клиент решил платить без него или вводит другой). */
    clearPromo(): void {
        const flow = this.ctx.session.paymentFlow;
        if (!flow) return;
        delete flow.promoCode;
        this.ctx.session.paymentFlow = flow;
    }

    clear(): void {
        delete this.ctx.session.paymentFlow;
    }
}
