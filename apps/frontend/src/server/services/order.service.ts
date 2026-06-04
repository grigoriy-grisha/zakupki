import {
    calculateFreeRemainder,
    calculateOrderAmount,
    ForbiddenError,
    getOrderQuantityValidationError,
    getSupplementOrderQuantityValidationError,
    isSupplementRemainderOnlyPhase,
    NotFoundError,
    PurchaseNotActiveError,
    ValidationError,
} from '@zakupki/types';

import { getTelegramChannelPostQueue } from '../lib/telegram-channel-post-queue';
import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';

export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
        private getPackDiscountPercent: () => Promise<number>,
    ) {}

    async upsert(purchaseItemId: number, userId: number, quantity: number, amountDue: number) {
        return this.repo.upsert(purchaseItemId, userId, quantity, amountDue);
    }

    async upsertOrder(purchaseItemId: number, userId: number, quantity: number) {
        const purchaseItem = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

        const status = purchaseItem.purchase.status as string;
        const fulfillmentStatus = (purchaseItem.purchase as { fulfillmentStatus?: string }).fulfillmentStatus;
        if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
            throw new PurchaseNotActiveError(status);
        }

        const packDiscountPercent = await this.getPackDiscountPercent();

        const amountDue = calculateOrderAmount(quantity, {
            priceTiers: purchaseItem.product.priceTiers,
            pricePerUnit: Number(purchaseItem.product.pricePerUnit),
            priceOverride: purchaseItem.priceOverride != null ? Number(purchaseItem.priceOverride) : null,
            supplierPackageAmount: purchaseItem.product.supplierPackageAmount,
            supplierPackageUnit: purchaseItem.product.supplierPackageUnit,
            supplierPackagePrice: purchaseItem.product.supplierPackagePrice,
            packDiscountPercent,
        });

        const unit = purchaseItem.product.unit;
        const orderQtyOptions = {
            multiplicity: unit ? Number(unit.multiplicity) : 1,
            minPackageAmount:
                purchaseItem.product.minPackageAmount != null
                    ? Number(purchaseItem.product.minPackageAmount)
                    : null,
            minPackageUnit: purchaseItem.product.minPackageUnit,
            purchaseItemMinQty: purchaseItem.minQty != null ? Number(purchaseItem.minQty) : null,
            unitShort: unit?.shortName ?? 'ед.',
        };

        const existingLine = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        const currentQty = existingLine ? Number(existingLine.quantity) : 0;

        const isSupplement = status === 'SUPPLEMENT' || fulfillmentStatus === 'REORDER';
        const rawAvailableQty =
            purchaseItem.availableQty !== null && purchaseItem.availableQty !== undefined
                ? Number(purchaseItem.availableQty)
                : null;
        const packAmount = purchaseItem.product.supplierPackageAmount != null
            ? Number(purchaseItem.product.supplierPackageAmount)
            : null;
        const freeRemainder = calculateFreeRemainder(
            (purchaseItem as any).orderLines ?? [],
            packAmount,
        );
        const effectiveAvailableQty = rawAvailableQty != null ? rawAvailableQty : freeRemainder;

        const validationError =
            isSupplement
                ? getSupplementOrderQuantityValidationError(quantity, orderQtyOptions, {
                      availableQty: effectiveAvailableQty,
                      currentQuantity: currentQty,
                      supplierPackageAmount: packAmount,
                      remainderOnly: isSupplementRemainderOnlyPhase(fulfillmentStatus),
                  })
                : getOrderQuantityValidationError(quantity, orderQtyOptions);
        if (validationError) {
            throw new ValidationError(validationError);
        }

        return this.upsertWithStock(purchaseItemId, userId, quantity, amountDue, { isSupplement });
    }

    async upsertWithStock(
        purchaseItemId: number,
        userId: number,
        quantity: number,
        amountDue: number,
        options?: { isSupplement?: boolean },
    ) {
        return this.repo.upsertWithStock(purchaseItemId, userId, quantity, amountDue, options);
    }

    async getByUser(userId: number) {
        const [lines, purchaseOrders] = await Promise.all([
            this.repo.getByUser(userId),
            this.repo.findPurchaseOrdersByUser(userId),
        ]);
        const orderIdByPurchase = new Map(purchaseOrders.map((o) => [o.purchaseId, o.id]));
        return lines.map((line) => ({
            ...line,
            purchaseOrderId: orderIdByPurchase.get(line.purchaseItem.purchase.id) ?? null,
        }));
    }

    async getByPurchase(purchaseId: number) {
        const [lines, purchaseOrders] = await Promise.all([
            this.repo.getByPurchase(purchaseId),
            this.repo.findPurchaseOrdersByPurchase(purchaseId),
        ]);
        const orderIdByUser = new Map(purchaseOrders.map((o) => [o.userId, o.id]));
        return lines.map((line) => ({
            ...line,
            purchaseOrderId: orderIdByUser.get(line.userId) ?? null,
        }));
    }

    /** Admin-only: delete without ownership check */
    async delete(id: number) {
        return this.repo.delete(id);
    }

    /** Delete with ownership verification — only the order's owner can cancel */
    async deleteAndRestoreStock(id: number, userId: number, options?: { throwIfNotFound?: boolean }) {
        const line = await this.repo.findById(id);
        if (!line) {
            if (options?.throwIfNotFound) throw new NotFoundError('Строка заказа', id);
            return null;
        }
        if (line.userId !== userId) {
            throw new ForbiddenError('Нельзя удалить чужой заказ');
        }
        const purchaseStatus = (line as any)?.purchaseItem?.purchase?.status;
        const purchaseFulfillmentStatus = (line as any)?.purchaseItem?.purchase?.fulfillmentStatus;
        const isSupplement = purchaseStatus === 'SUPPLEMENT' || purchaseFulfillmentStatus === 'REORDER';
        return this.repo.deleteAndRestoreStock(id, { ...options, isSupplement });
    }

    async getByPurchaseItem(purchaseItemId: number) {
        return this.repo.getByPurchaseItem(purchaseItemId);
    }

    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        const lines = await this.repo.findByUserAndPurchase(userId, purchaseId);
        if (lines.length === 0) return 0;

        const purchase = (lines[0] as any)?.purchaseItem?.purchase;
        const purchaseStatus = purchase?.status as string | undefined;
        const fulfillmentStatus = purchase?.fulfillmentStatus as string | undefined;
        const isSupplement = purchaseStatus === 'SUPPLEMENT' || fulfillmentStatus === 'REORDER';

        // Read message IDs before deleting lines
        const messageIds = await this.repo.findMessageIdsByUserAndPurchase(userId, purchaseId);

        for (const line of lines) {
            await this.repo.deleteAndRestoreStock(line.id, { isSupplement });
        }

        await this.repo.deletePurchaseOrder(userId, purchaseId);

        if (messageIds.length > 0) {
            try {
                const queue = getTelegramChannelPostQueue();
                await queue.addPurchaseItemPost({
                    type: 'USER_ORDERS_REJECT',
                    messageIds: messageIds.map(String),
                });
            } catch (err) {
                console.warn('[order] Failed to enqueue USER_ORDERS_REJECT:', err);
            }
        }

        return lines.length;
    }
}
