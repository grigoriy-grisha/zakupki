import { serviceContainer } from '@/server/lib/service-container';

import type { PurchaseFulfillmentStatus } from '@zakupki/types';

/**
 * Bot-slice OrderService. Тонкая обёртка над `serviceContainer.order`.
 *
 * Включает только те методы, которые вызываются из bot handlers/services.
 * При полной изоляции (Phase E+) — копия из `services/order.service.ts` с
 * прямыми Prisma-запросами вместо OrderRepository.
 */

export type BotPurchaseListItem = {
    purchaseId: number;
    tag: string;
    fulfillmentStatus: PurchaseFulfillmentStatus;
    totalDue: number;
};

export type BotPurchaseOrderDetail = {
    purchaseOrderId: number | null;
    tag: string;
    totalDue: number;
    lines: Array<{
        id: number;
        quantity: number;
        packageCount: number;
        amountDue: number;
        status: string;
        purchaseItem: {
            id: number;
            product: { name: string; unitCode: string } | null;
            purchase: { fulfillmentStatus: string };
        } | null;
    }>;
};

export class BotOrderService {
    async getActivePurchases(userId: number): Promise<BotPurchaseListItem[]> {
        return serviceContainer.order.getActivePurchases(userId) as Promise<BotPurchaseListItem[]>;
    }

    async getPurchaseOrderDetail(userId: number, purchaseId: number): Promise<BotPurchaseOrderDetail | null> {
        return serviceContainer.order.getPurchaseOrderDetail(userId, purchaseId) as Promise<BotPurchaseOrderDetail | null>;
    }

    async getActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return serviceContainer.order.getActiveLinesForUserItem(purchaseItemId, userId);
    }

    async adjustQuantity(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        return serviceContainer.order.adjustQuantity(purchaseItemId, userId, delta);
    }

    async adjustPackageCount(purchaseItemId: number, userId: number, delta: number): Promise<void> {
        return serviceContainer.order.adjustPackageCount(purchaseItemId, userId, delta);
    }
}
