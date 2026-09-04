import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { serviceContainer } from '@/server/lib/service-container';
import type { PurchasePaymentInfo } from '@/server/services/bot-payment.service';

export type BotPurchasePaymentInfo = PurchasePaymentInfo;

export type BotPayablePurchase = {
    purchaseId: number;
    tag: string;
    remaining: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

export type BotUserPaymentsResult = {
    payments: Array<{
        amount: unknown;
        status: string;
        submittedAt: Date;
        children?: Array<{ amount: unknown }> | null;
        purchase?: { tag: string } | null;
    }>;
    lines: string[];
};

export class BotPaymentService {
    async getUserPayments(userId: number): Promise<BotUserPaymentsResult> {
        return serviceContainer.botPayment.getUserPayments(userId) as Promise<BotUserPaymentsResult>;
    }

    async getPayablePurchases(userId: number): Promise<BotPayablePurchase[]> {
        return serviceContainer.botPayment.getPayablePurchases(userId) as Promise<BotPayablePurchase[]>;
    }

    async getPurchasePaymentInfo(userId: number, purchaseId: number): Promise<BotPurchasePaymentInfo | null> {
        return serviceContainer.botPayment.getPurchasePaymentInfo(userId, purchaseId) as Promise<
            BotPurchasePaymentInfo | null
        >;
    }

    async submitPaymentWithProof(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofData: Buffer;
        proofMimeType: string;
        promoCodeId?: number;
        discountAmount?: number;
    }): Promise<unknown> {
        return serviceContainer.botPayment.submitPaymentWithProof(data);
    }

    /** Validates a promo code against an order amount. */
    async validatePromoCode(
        code: string,
        purchaseId: number,
        orderAmount: number,
    ): Promise<{ id: number; code: string; label: string | null; discount: number; finalAmount: number }> {
        return serviceContainer.botPayment.validatePromoCode(code, purchaseId, orderAmount);
    }
}
