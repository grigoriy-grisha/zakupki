import { NotFoundError, ValidationError, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { formatPurchaseTag } from '../domain/product-purchase-lock';
import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { ProductRepository } from '../domain/product.repository';
import { handleDbConflict } from '../lib/error-utils';
import type { TelegramPublishService } from './telegram-publish.service';
import {
    canTransitionFulfillment,
    isFreezePoint,
    isPaymentPlusFreezePoint,
    isUnfreezePoint,
    FULFILLMENT_TRANSITIONS,
} from '@zakupki/types';

export class PurchaseService {
    constructor(
        private repo: PurchaseRepository,
        private productRepo: ProductRepository,
        private telegramPublish: TelegramPublishService,
        private orderRepo: OrderRepository,
    ) {}

    async list(status?: string) {
        return this.repo.list(status);
    }

    async listByStatuses(statuses: string[]) {
        return this.repo.listByStatuses(statuses);
    }

    async listByStatusesForUser(userId: number, statuses: string[]) {
        return this.repo.listByStatusesForUser(userId, statuses);
    }

    async getById(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        return purchase;
    }

    async create(data: { tag: string; supplier: string; minAmount: number; deadline: Date }) {
        const tag = formatPurchaseTag(data.tag);
        const existing = await this.repo.findByTag(tag);
        if (existing) {
            throw new ValidationError(`Закупка с тегом «${tag}» уже существует. Укажите другой тег.`);
        }

        try {
            return await this.repo.create({ ...data, tag });
        } catch (err) {
            handleDbConflict(err);
        }
    }

    async updateStatus(id: number, status: string) {
        return this.repo.updateStatus(id, status);
    }

    async updateFulfillmentStatus(id: number, fulfillmentStatus: string) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        const current = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
        const next = fulfillmentStatus as PurchaseFulfillmentStatus;

        if (!canTransitionFulfillment(current, next)) {
            const allowed = FULFILLMENT_TRANSITIONS[current] ?? [];
            throw new ValidationError(
                `Недопустимый переход: ${current} → ${next}. Разрешено: ${allowed.join(', ') || '(нет)'} `,
            );
        }

        const result = await this.repo.updateFulfillmentStatus(id, next);

        // Заморозка baseQuantity при COLLECTION → REORDER И при REORDER → PAYMENT+
        // (повторная заморозка COLLECTION-строк, удалённых/пересозданных на REORDER).
        // freezeBaseQuantities идемпотентен: фильтрует `baseQuantity: null`.
        if (isFreezePoint(next) || isPaymentPlusFreezePoint(next)) {
            await this.orderRepo.freezeBaseQuantities(id);
        }

        // Разморозка при откате REORDER → COLLECTION
        if (isUnfreezePoint(next)) {
            await this.orderRepo.unfreezeBaseQuantities(id);
        }

        return result;
    }

    async activate(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status !== 'DRAFT') {
            throw new ValidationError('Активировать можно только черновик');
        }
        return this.repo.updateStatus(purchaseId, 'ACTIVE');
    }

    async findItemsToPublish(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status !== 'ACTIVE') {
            throw new ValidationError('Публиковать в Telegram можно только для активной закупки');
        }
        return this.repo.findUnpublishedItems(purchaseId);
    }

    async complete(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'ACTIVE') {
            throw new ValidationError('Завершить можно только активную закупку');
        }
        return this.repo.updateStatus(id, 'DONE');
    }

    async deleteDraft(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'DRAFT') {
            throw new ValidationError('Удалить можно только черновик');
        }
        const deleted = await this.repo.deleteDraft(id);
        if (!deleted) throw new NotFoundError('Закупка', id);
        return deleted;
    }

    async setPublicationState(purchaseItemId: number, state: 'DRAFT' | 'PUBLISHED') {
        const item = await this.repo.findItemWithPurchase(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);
        if (item.tgMessageId) {
            throw new ValidationError('Нельзя изменить статус публикации для уже опубликованного товара');
        }
        if (item.purchase.status === 'DONE') {
            throw new ValidationError('Нельзя изменить статус публикации в завершённой закупке');
        }
        return this.repo.setPublicationState(purchaseItemId, state);
    }

    async ensureCanPublishItem(purchaseItemId: number) {
        const item = await this.repo.findItemWithPurchase(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);
        if (item.purchase.status !== 'ACTIVE') {
            throw new ValidationError('Публиковать в Telegram можно только для активной закупки');
        }
        if (item.tgMessageId) {
            throw new ValidationError('Товар уже опубликован в Telegram');
        }
    }

    async ensureItemExists(purchaseItemId: number) {
        const item = await this.repo.findItemById(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);
    }

    async updateItemProduct(
        purchaseItemId: number,
        productData: Record<string, unknown>,
        priceOverride: number | null,
    ) {
        const item = await this.repo.findItemWithProductAndTg(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);

        // Write price override to PurchaseItem (per-purchase pricing)
        // Don't write pricePerUnit to the shared product — use priceOverride on the item
        const { pricePerUnit, supplementStep, supplierLimit, supplierLimitUnit, ...nonPriceFields } =
            productData as Record<string, unknown>;
        void pricePerUnit; // consumed via priceOverride below

        // Update product fields (description, packaging, etc.) but NOT pricePerUnit
        if (Object.keys(nonPriceFields).length > 0) {
            await this.productRepo.update(item.productId, nonPriceFields as any);
        }

        // Собираем partial update PurchaseItem за один round-trip.
        // Только поля, которые явно пришли из формы (не undefined).
        const itemUpdate: {
            priceOverride: number | null;
            supplementStep?: number | null;
            supplierLimit?: number | null;
            supplierLimitUnit?: string | null;
        } = { priceOverride };
        if (supplementStep !== undefined) itemUpdate.supplementStep = supplementStep as number | null;
        if (supplierLimit !== undefined) {
            itemUpdate.supplierLimit = supplierLimit as number | null;
            itemUpdate.supplierLimitUnit = (supplierLimitUnit as string | null) ?? null;
        }
        await this.repo.updatePurchaseItem(purchaseItemId, itemUpdate);

        return item;
    }

    async addItems(purchaseId: number, productIds: number[]) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status === 'DONE') {
            throw new ValidationError('В завершённую закупку нельзя добавлять товары');
        }

        const uniqueIds = [...new Set(productIds)];
        const alreadyInPurchase = await this.repo.findProductIdsInPurchase(purchaseId, uniqueIds);
        const alreadySet = new Set(alreadyInPurchase);
        const newProductIds = uniqueIds.filter((id) => !alreadySet.has(id));

        if (newProductIds.length === 0) {
            return { items: [], skippedCount: uniqueIds.length };
        }

        const items = [];
        for (const productId of newProductIds) {
            const item = await this.repo.addItem(purchaseId, productId);
            items.push(item);
        }
        return { items, skippedCount: uniqueIds.length - newProductIds.length };
    }

    async removeItem(id: number) {
        const item = await this.repo.findItemWithPurchase(id);
        if (!item) throw new NotFoundError('Позиция закупки', id);

        if (item.tgMessageId && item.tgChannelId) {
            await this.telegramPublish.enqueueDeleteChannelPost(item.tgChannelId, item.tgMessageId);
        }

        return this.repo.removeItem(id);
    }

    async setAvailableQuantities(
        purchaseId: number,
        items: { purchaseItemId: number; targetRemainder: number | null; supplementStep?: number | null }[],
    ) {
        return this.repo.setAvailableQuantities(purchaseId, items);
    }

    async findItemWithPrice(purchaseItemId: number) {
        return this.repo.findItemWithPrice(purchaseItemId);
    }

    /**
     * Пересчитать amountDue для всех ACTIVE заказов в закупке.
     * Вызывается после изменения цены админом (priceOverride, priceTiers).
     */
    async recalculateAmounts(purchaseId: number) {
        const { calculateOrderAmount } = await import('@zakupki/types');
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);

        for (const item of purchase.items) {
            for (const line of item.orderLines) {
                if (line.status !== 'ACTIVE') continue;
                const qty = Number(line.quantity);
                const amountDue = calculateOrderAmount(qty, {
                    priceTiers: item.product.priceTiers,
                    pricePerUnit: Number(item.product.pricePerUnit),
                    priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
                    supplierPackageAmount: item.product.supplierPackageAmount,
                    supplierPackageUnit: item.product.supplierPackageUnit,
                    supplierPackagePrice: item.product.supplierPackagePrice,
                    packDiscountPercent: 0, // TODO: get from PricingSettingsService when wired
                });
                await this.orderRepo.updateAmountDue(line.id, amountDue);
            }
        }
    }
}
