import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { serviceContainer } from '@/server/lib/service-container';
import type { PurchasePaymentInfo } from '@/server/services/bot-payment.service';
import type {
    CreatedOnlinePayment,
    OnlinePaymentConfig,
    OnlinePaymentMethod,
    SyncResult,
} from '@/server/services/online-payment.service';

export type BotPurchasePaymentInfo = PurchasePaymentInfo;

export type BotPayablePurchase = {
    purchaseId: number;
    tag: string;
    available: number;
    pending: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

export type BotUserPaymentsResult = {
    payments: Array<{
        id: number;
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
        return serviceContainer.botPayment.getPurchasePaymentInfo(
            userId,
            purchaseId,
        ) as Promise<BotPurchasePaymentInfo | null>;
    }

    /** Комиссии, нужен ли чек и сохранённый контакт для чека. */
    async getOnlineConfig(userId: number): Promise<OnlinePaymentConfig & { receiptContact: string | null }> {
        const [config, receiptContact] = await Promise.all([
            serviceContainer.onlinePayment.getConfig(),
            serviceContainer.onlinePayment.getSavedReceiptContact(userId),
        ]);
        return { ...config, receiptContact };
    }

    /** Создаёт онлайн-платёж в Т-Банке; amount — сумма до промокода. */
    async createOnlinePayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        method: OnlinePaymentMethod;
        promoCode?: string;
        receiptContact?: string;
        returnUrl?: string;
    }): Promise<CreatedOnlinePayment> {
        return serviceContainer.onlinePayment.create(data);
    }

    /** Сверяет неоплаченные онлайн-ссылки клиента с банком. */
    async syncOnlinePayments(userId: number): Promise<SyncResult> {
        return serviceContainer.onlinePayment.syncForUser(userId);
    }

    /** Validates a promo code against an order amount. */
    async validatePromoCode(
        code: string,
        purchaseId: number,
        orderAmount: number,
        userId?: number,
    ): Promise<{ id: number; code: string; label: string | null; discount: number; finalAmount: number }> {
        return serviceContainer.botPayment.validatePromoCode(code, purchaseId, orderAmount, userId);
    }

    /** Промокод, закреплённый за заказом прошлой оплатой. */
    async findPinnedPromo(userId: number, purchaseId: number) {
        return serviceContainer.botPayment.findPinnedPromo(userId, purchaseId);
    }

    /** Пользователь отменяет свою оплату, которая ещё на проверке. */
    /** Есть ли у клиента созданные, но не оплаченные ссылки. */
    async hasAwaitingLinks(userId: number): Promise<boolean> {
        return serviceContainer.onlinePayment.hasAwaiting(userId);
    }

    async cancelPayment(userId: number, paymentId: number): Promise<unknown> {
        return serviceContainer.payment.cancel(paymentId, userId);
    }
}
