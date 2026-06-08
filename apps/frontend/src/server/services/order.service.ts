import {
    NotFoundError,
    ValidationError,
    calculateOrderAmount,
    canAddNewItem,
    canCancelOrder,
    canDecreaseOrder,
    canIncreaseFromRemainder,
} from '@zakupki/types';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import type { PricingSettingsService } from '../services/settings/pricing-settings';

/**
 * Сервис заказов — управление строками OrderLine.
 * Поддерживает этапную модель: COLLECTION / REORDER / PAYMENT / ...
 */
export class OrderService {
    constructor(
        private repo: OrderRepository,
        private purchaseRepo: PurchaseRepository,
        private pricingSettings: PricingSettingsService,
    ) {}

    /**
     * Изменить количество на delta (может быть положительным или отрицательным).
     * delta = +minPackaging или -minPackaging.
     */
    async adjustQuantity(purchaseItemId: number, userId: number, delta: number) {
        if (delta === 0) return;

        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!item) {
            throw new NotFoundError('Товар закупки', purchaseItemId);
        }

        const fulfillmentStatus = (item.purchase.fulfillmentStatus ?? 'COLLECTION') as string;
        const existing = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        const currentQty = existing ? Number(existing.quantity) : 0;
        const newQty = currentQty + delta;

        // Проверки по этапам
        if (!existing) {
            // Новая строка заказа — можно только в COLLECTION
            if (!canAddNewItem(fulfillmentStatus)) {
                throw new ValidationError('На этом этапе нельзя добавить новый товар');
            }
        } else if (delta > 0) {
            // Увеличение — добор из остатка (REORDER, PAYMENT и далее)
            if (!canIncreaseFromRemainder(fulfillmentStatus)) {
                throw new ValidationError('На этом этапе нельзя увеличить заказ');
            }
        } else {
            // Уменьшение — COLLECTION/REORDER свободно, PAYMENT+ — не ниже baseQuantity
            if (!canDecreaseOrder(fulfillmentStatus)) {
                throw new ValidationError('На этом этапе нельзя уменьшить заказ');
            }
            // На PAYMENT и далее — нельзя убавить ниже замороженного baseQuantity
            if (fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER') {
                const baseQty = existing.baseQuantity != null ? Number(existing.baseQuantity) : 0;
                if (baseQty > 0 && newQty < baseQty) {
                    throw new ValidationError(
                        `Нельзя убавить ниже базового заказа (${baseQty}). Можно убрать только доборную часть.`,
                    );
                }
            }
        }

        if (newQty <= 0) {
            if (fulfillmentStatus === 'COLLECTION') {
                // На COLLECTION — чистое удаление, baseQuantity нет
                return this.repo.deleteOrderLine(purchaseItemId, userId);
            }
            // На REORDER+ — обнуляем без удаления, сохраняем baseQuantity
            // чтобы пользователь мог снова добрать из остатка
            if (existing) {
                return this.repo.zeroOutOrderLine(purchaseItemId, userId);
            }
            return null;
        }

        // Вычисляем сумму через calculateOrderAmount (с учётом упаковок)
        const currentPkgCount = existing?.packageCount ?? 0;
        const amountDue = await this.computeAmountDueWithPackages(newQty, currentPkgCount, item);

        return this.repo.upsertOrderLine(purchaseItemId, userId, newQty, amountDue);
    }

    /**
     * Вычислить сумму заказа через calculateOrderAmount.
     */
    private async computeAmountDue(
        quantity: number,
        item: Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>,
    ): Promise<number> {
        if (!item) return 0;

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();

        return calculateOrderAmount(quantity, {
            priceTiers: item.product.priceTiers,
            pricePerUnit: Number(item.product.pricePerUnit),
            priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
            supplierPackageAmount: item.product.supplierPackageAmount,
            supplierPackageUnit: item.product.supplierPackageUnit,
            supplierPackagePrice: item.product.supplierPackagePrice,
            packDiscountPercent,
        });
    }

    /**
     * Вычислить полную сумму с учётом quantity и packageCount.
     */
    private async computeAmountDueWithPackages(
        quantity: number,
        packageCount: number,
        item: NonNullable<Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>>,
    ): Promise<number> {
        const baseAmount = await this.computeAmountDue(quantity, item);
        const pkgPrice = this.getPackagePrice(item);
        return baseAmount + packageCount * pkgPrice;
    }

    /**
     * Цена одной упаковки поставщика.
     */
    private getPackagePrice(item: NonNullable<Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>>): number {
        if (item.product.supplierPackagePrice != null && Number(item.product.supplierPackagePrice) > 0) {
            return Number(item.product.supplierPackagePrice);
        }
        return Number(item.product.pricePerUnit) * Number(item.product.supplierPackageAmount ?? 0);
    }

    /**
     * Изменить количество упаковок на delta (+1 / -1).
     * Упаковка = целая нераспечатанная пачка поставщика.
     */
    async adjustPackageCount(purchaseItemId: number, userId: number, delta: number) {
        if (delta === 0) return;

        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!item) {
            throw new NotFoundError('Товар закупки', purchaseItemId);
        }

        const fulfillmentStatus = (item.purchase.fulfillmentStatus ?? 'COLLECTION') as string;

        // Упаковки доступны только на COLLECTION и REORDER
        if (fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER') {
            throw new ValidationError('На этом этапе нельзя добавить упаковку');
        }

        // Проверяем что у продукта есть размер упаковки
        const packAmount = item.product.supplierPackageAmount;
        if (!packAmount || Number(packAmount) <= 0) {
            throw new ValidationError('У товара не указан размер упаковки поставщика');
        }

        const existing = await this.repo.findByPurchaseItemAndUser(purchaseItemId, userId);
        const currentPkgCount = existing?.packageCount ?? 0;
        const newPkgCount = currentPkgCount + delta;

        if (newPkgCount < 0) {
            throw new ValidationError('Количество упаковок не может быть отрицательным');
        }

        // Если OrderLine не существует и delta > 0 — можно создать (COLLECTION позволяет новые)
        if (!existing && !canAddNewItem(fulfillmentStatus)) {
            throw new ValidationError('На этом этапе нельзя добавить новый товар');
        }

        const qty = existing ? Number(existing.quantity) : 0;
        const amountDue = await this.computeAmountDueWithPackages(qty, newPkgCount, item);

        return this.repo.upsertOrderLine(purchaseItemId, userId, qty, amountDue, newPkgCount);
    }

    async getUserOrders(userId: number) {
        return this.repo.getByUser(userId);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async cancelOrder(id: number, userId: number) {
        const line = await this.repo.findById(id);
        if (!line) {
            return null;
        }
        if (line.userId !== userId) {
            throw new ValidationError('Нельзя отменить чужой заказ');
        }

        const fulfillmentStatus =
            line.purchaseItem?.purchase?.fulfillmentStatus ?? 'COLLECTION';
        if (!canCancelOrder(fulfillmentStatus)) {
            throw new ValidationError('На этом этапе нельзя отменить заказ');
        }

        return this.repo.cancelOrder(id);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }

    /**
     * Удалить все заказы пользователя в закупке.
     */
    async removeAllByUserFromPurchase(userId: number, purchaseId: number) {
        return this.repo.deleteAllByUserAndPurchase(userId, purchaseId);
    }

    /**
     * Получить активные закупки пользователя (у которых есть неотменённые заказы).
     */
    async getActivePurchases(userId: number) {
        const orders = await this.repo.findActiveOrdersByUserId(userId);
        if (orders.length === 0) return [];

        // Группируем по purchaseId
        const byPurchase = new Map<number, { purchaseId: number; tag: string; fulfillmentStatus: string; totalDue: number }>();
        for (const line of orders) {
            const p = line.purchaseItem.purchase;
            const existing = byPurchase.get(p.id);
            if (existing) {
                existing.totalDue += Number(line.amountDue);
            } else {
                byPurchase.set(p.id, {
                    purchaseId: p.id,
                    tag: p.tag,
                    fulfillmentStatus: (p as any).fulfillmentStatus ?? 'COLLECTION',
                    totalDue: Number(line.amountDue),
                });
            }
        }
        return Array.from(byPurchase.values());
    }

    /**
     * Получить детали заказа пользователя по закупке.
     */
    async getPurchaseOrderDetail(userId: number, purchaseId: number) {
        const lines = await this.repo.findByUserAndPurchase(userId, purchaseId);
        if (lines.length === 0) return null;

        const tag = lines[0]!.purchaseItem.purchase.tag;
        const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue), 0);

        return {
            purchaseOrderId: null as any,
            tag,
            totalDue,
            supplier: (lines[0]!.purchaseItem.purchase as any).supplier ?? null,
            lines: lines.map((l) => ({
                id: l.id,
                quantity: Number(l.quantity),
                packageCount: l.packageCount ?? 0,
                amountDue: Number(l.amountDue),
                status: l.status,
                purchaseItem: l.purchaseItem,
                userId: l.userId,
                baseQuantity: l.baseQuantity,
                tgChatMessageId: l.tgChatMessageId,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        };
    }
}