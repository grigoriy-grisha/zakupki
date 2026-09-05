import { createLogger } from '@zakupki/logger';
import type { EventBus } from '@zakupki/queue';
import {
    applyPieceUnitInvariants,
    canAddItemsAtStage,
    computeAmountDueWithPackages,
    isPieceUnit,
    mapToPurchaseItem,
    NotFoundError,
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
    ValidationError,
} from '@zakupki/types';

import type { OrderRepository } from '../domain/order.repository';
import type { ProductCharacteristicInput } from '../domain/product.repository';
import type { ProductRepository } from '../domain/product.repository';
import { formatPurchaseTag } from '../domain/product-purchase-lock';
import type { PurchaseRepository } from '../domain/purchase.repository';
import { handleDbConflict } from '../lib/error-utils';
import type { NotificationService } from './notification.service';
import type { PricingSettingsService } from './settings/pricing-settings';
import type { TelegramPublishService } from './telegram-publish.service';

const log = createLogger('purchase-service');

export class PurchaseService {
    constructor(
        private repo: PurchaseRepository,
        private productRepo: ProductRepository,
        private telegramPublish: TelegramPublishService,
        private orderRepo: OrderRepository,
        private eventBus: EventBus,
        private pricingSettings: PricingSettingsService,
        private notification: NotificationService,
    ) {}

    async list(status?: string, includeHidden = false) {
        return this.repo.list(status, includeHidden);
    }

    async listByStatuses(statuses: string[], includeHidden = false) {
        return this.repo.listByStatuses(statuses, includeHidden);
    }

    async listByStatusesForUser(userId: number, statuses: string[], includeHidden = false) {
        return this.repo.listByStatusesForUser(userId, statuses, includeHidden);
    }

    async listDeleted() {
        return this.repo.listDeleted();
    }

    async getById(id: number, includeHidden = false) {
        const purchase = await this.repo.getById(id, includeHidden);
        if (!purchase) throw new NotFoundError('Закупка', id);
        return purchase;
    }

    async create(data: { tag: string }) {
        const tag = formatPurchaseTag(data.tag);
        const existing = await this.repo.findByTag(tag);
        if (existing) {
            throw new ValidationError(`Закупка с тегом «${tag}» уже существует. Укажите другой тег.`);
        }

        try {
            return await this.repo.create({ tag });
        } catch (err) {
            handleDbConflict(err);
        }
    }

    async deleteDraft(id: number) {
        const purchase = await this.repo.getById(id, true);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'DRAFT') {
            throw new ValidationError('Удалить можно только черновик');
        }
        const deleted = await this.repo.deleteDraft(id);
        if (!deleted) throw new NotFoundError('Закупка', id);
        return deleted;
    }

    async softDelete(id: number) {
        const purchase = await this.repo.getById(id, true);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.deletedAt) {
            throw new ValidationError('Закупка уже удалена');
        }
        return this.repo.softDelete(id);
    }

    async findItemsToPublish(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId, true);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status !== 'ACTIVE') {
            throw new ValidationError('Публиковать в Telegram можно только для активной закупки');
        }
        return this.repo.findUnpublishedItems(purchaseId);
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
        if (!item) throw new NotFoundError('Позиция закупки', purchaseItemId);
        if (item.purchase.status !== 'ACTIVE') {
            throw new ValidationError('Публиковать в Telegram можно только для активной закупки');
        }
        if (item.tgMessageId) {
            throw new ValidationError('Товар уже опубликован в Telegram');
        }
    }

    async deleteItemPost(purchaseItemId: number) {
        const item = await this.repo.findItemWithPurchase(purchaseItemId);
        if (!item) throw new NotFoundError('Позиция закупки', purchaseItemId);
        if (!item.tgMessageId) {
            throw new ValidationError('Пост не опубликован');
        }

        await this.repo.updatePurchaseItem(purchaseItemId, {
            tgMessageId: null,
            tgChannelId: null,
            publicationState: 'DRAFT',
        });
        await this.telegramPublish.enqueueDeleteChannelPost(
            purchaseItemId,
            item.tgMessageId,
            item.tgChannelId,
        );
    }

    async ensureItemExists(purchaseItemId: number) {
        const item = await this.repo.findItemById(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);
    }

    async updateItemProduct(purchaseItemId: number, itemData: Record<string, unknown>) {
        const item = await this.repo.findItemWithProductAndTg(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);

        const itemUpdate: Record<string, unknown> = {};
        const allowedKeys = [
            'supplierId',
            'description',
            'minPackageAmount',
            'minPackageUnit',
            'supplementStep',
            'supplierLimit',
            'supplierLimitUnit',
            'targetRemainder',
            'packAmount',
            'packUnit',
            'currencyId',
            'pricePerPackCurrency',
            'orgFeePercentOverride',
            'deliveryPercentOverride',
            'orderedQty',
            'assembledQty',
            'reorderedQty',
            'adminComment',
            'hidden',
        ] as const;
        for (const key of allowedKeys) {
            if (itemData[key] !== undefined) itemUpdate[key] = itemData[key];
        }

        const nextUnitCode = itemData.productUnitCode;
        if (typeof nextUnitCode === 'string') {
            itemUpdate.unitCode = nextUnitCode;
            applyPieceUnitInvariants(nextUnitCode, itemUpdate);
        }

        if (Array.isArray(itemData.characteristics)) {
            const characteristics: ProductCharacteristicInput[] = (
                itemData.characteristics as Record<string, unknown>[]
            ).map((c) => ({
                characteristicId: Number(c.characteristicId),
                value: String(c.value ?? ''),
                showOnCard: c.showOnCard === true,
            }));
            await this.productRepo.replaceCharacteristicValues(item.productId, characteristics);
        }

        const pricingKeys = [
            'packAmount',
            'currencyId',
            'pricePerPackCurrency',
            'orgFeePercentOverride',
            'deliveryPercentOverride',
            'unitCode',
        ];
        const pricingChanged = pricingKeys.some((key) => itemUpdate[key] !== undefined);
        if (pricingChanged && item.purchase?.status === 'DONE') {
            throw new ValidationError('В завершённой закупке нельзя менять цены');
        }

        if (typeof nextUnitCode === 'string' && nextUnitCode !== item.product.unitCode) {
            await this.productRepo.update(item.productId, { unitCode: nextUnitCode });
        }

        const hidingPublishedItem = itemData.hidden === true && item.tgMessageId != null;
        if (hidingPublishedItem) {
            itemUpdate.tgMessageId = null;
            itemUpdate.tgChannelId = null;
            itemUpdate.publicationState = 'DRAFT';
        }

        await this.repo.updatePurchaseItem(purchaseItemId, itemUpdate);

        if (pricingChanged) {
            await this.recalculateAmounts(item.purchaseId);
        }

        if (hidingPublishedItem) {
            await this.eventBus.emitPostDelete(
                purchaseItemId,
                item.tgMessageId ?? undefined,
                item.tgChannelId ?? undefined,
            );
        } else {
            await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
        }

        return item;
    }

    /**
     * Добавляет позиции в закупку. Каждая позиция — это (productId, supplierId)
     * + per-purchase поля (опционально). Дубликаты по (productId, supplierId)
     * пропускаются. Один и тот же productId можно добавлять с разными supplierId.
     */
    async addItems(
        purchaseId: number,
        items: {
            productId: number;
            supplierId?: number | null;
            description?: string | null;
            minPackageAmount?: number | null;
            minPackageUnit?: string | null;
            supplementStep?: number | null;
            packAmount?: number | null;
            packUnit?: string | null;
            currencyId?: number | null;
            pricePerPackCurrency?: number | null;
            orgFeePercentOverride?: number | null;
            deliveryPercentOverride?: number | null;
            supplierLimit?: number | null;
            supplierLimitUnit?: string | null;
            targetRemainder?: number | null;
            productUnitCode?: string;
            characteristics?: ProductCharacteristicInput[];
        }[],
    ) {
        const purchase = await this.repo.getById(purchaseId, true);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status === 'DONE') {
            throw new ValidationError('В завершённую закупку нельзя добавлять товары');
        }
        if (!canAddItemsAtStage(purchase.fulfillmentStatus)) {
            const stage = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
            throw new ValidationError(
                `На этапе «${PURCHASE_FULFILLMENT_LABELS[stage]}» добавление товаров недоступно`,
            );
        }

        if (items.length === 0) {
            return { items: [], skippedCount: 0 };
        }

        // Дедупликация по (productId, supplierId) внутри одного запроса
        const seen = new Set<string>();
        const uniqueConfigs = items.filter((c) => {
            const key = `${c.productId}::${c.supplierId ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Проверяем, какие (productId, supplierId) уже есть в закупке
        const existing = await this.repo.findExistingPurchaseItems(
            purchaseId,
            uniqueConfigs.map((c) => ({ productId: c.productId, supplierId: c.supplierId ?? null })),
        );
        const existingSet = new Set(existing.map((e) => `${e.productId}::${e.supplierId ?? ''}`));

        const toCreate = uniqueConfigs.filter((c) => !existingSet.has(`${c.productId}::${c.supplierId ?? ''}`));

        const productUnits = await this.repo.getProductUnitCodes(
            Array.from(new Set(toCreate.map((c) => c.productId))),
        );
        const unitByProduct = new Map(productUnits.map((p) => [p.id, p.unitCode]));

        const created = [];
        for (const source of toCreate) {
            const config = { ...source };
            const unitCode = config.productUnitCode ?? unitByProduct.get(config.productId) ?? 'piece';
            applyPieceUnitInvariants(unitCode, config);
            if (isPieceUnit(unitCode) && config.packAmount == null) {
                config.packAmount = 1;
            }
            const item = await this.repo.addItem(purchaseId, { ...config, unitCode });
            created.push(item);
        }

        const unitUpdates = new Map(
            toCreate
                .filter((c) => typeof c.productUnitCode === 'string')
                .map((c) => [c.productId, c.productUnitCode as string]),
        );
        for (const [productId, unitCode] of unitUpdates) {
            await this.productRepo.update(productId, { unitCode });
        }

        const characteristicUpdates = new Map<number, ProductCharacteristicInput[]>();
        for (const c of toCreate) {
            if (c.characteristics !== undefined) {
                characteristicUpdates.set(c.productId, c.characteristics);
            }
        }
        for (const [productId, characteristics] of characteristicUpdates) {
            await this.productRepo.replaceCharacteristicValues(productId, characteristics);
        }

        return {
            items: created,
            skippedCount: items.length - created.length,
        };
    }

    async removeItem(id: number) {
        const item = await this.repo.findItemWithPurchase(id);
        if (!item) throw new NotFoundError('Позиция закупки', id);
        if (item.purchase?.status === 'DONE') {
            throw new ValidationError('В завершённой закупке нельзя удалять позиции');
        }

        const affectedUserIds = await this.orderRepo.findActiveLineUserIds(id);
        const label = await this.repo.findItemLabel(id);

        if (item.tgMessageId) {
            await this.telegramPublish.enqueueDeleteChannelPost(
                id,
                item.tgMessageId,
                item.tgChannelId,
            );
        }

        const result = await this.repo.removeItem(id);

        if (label && affectedUserIds.length > 0) {
            await Promise.all(
                affectedUserIds.map((userId) =>
                    this.notification
                        .notify({
                            userId,
                            type: 'ORDER_LINE_DELETED',
                            payload: {
                                purchaseId: label.purchaseId,
                                purchaseTag: label.purchaseTag,
                                purchaseItemId: id,
                                productLabel: label.productLabel,
                            },
                        })
                        .catch((err) =>
                            log.warn({ purchaseItemId: id, userId, err }, 'failed to notify item removal'),
                        ),
                ),
            );
        }

        return result;
    }

    async setAvailableQuantities(
        purchaseId: number,
        items: { purchaseItemId: number; targetRemainder: number | null; supplementStep?: number | null }[],
    ) {
        const result = await this.repo.setAvailableQuantities(purchaseId, items);
        // targetRemainder/supplementStep влияют на статусный блок поста — emit'им обновление
        // для каждого item (попадает в debounce 7s в шине channel-post-events).
        await Promise.all(items.map((i) => this.eventBus.emitPurchaseItemChanged(i.purchaseItemId)));
        return result;
    }

    async findItemWithPrice(purchaseItemId: number) {
        return this.repo.findItemWithPrice(purchaseItemId);
    }

    /**
     * Пересчитать amountDue для всех ACTIVE заказов в закупке.
     * Вызывается после изменения цены админом (priceOverride, priceTiers).
     * После пересчёта эмитит `emitPurchaseItemChanged` для каждого item — воркер
     * перерендерит пост в канале (включая «Свободно к заказу»).
     */
    async recalculateAmounts(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId, true);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();
        const orgFeeDefaultPercent = await this.pricingSettings.getOrgFeeDefaultPercent();
        const currencyRates = (purchase.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        const touchedItemIds = new Set<number>();
        const changedByUser = new Map<number, { prev: number; next: number }>();
        for (const item of purchase.items) {
            // Доменный PurchaseItem для canonical-прайсинга. getById не вкладывает
            // purchase в каждый item — инжектим fulfillmentStatus из родителя.
            const domainItem = mapToPurchaseItem(
                { ...item, purchase: { fulfillmentStatus: purchase.fulfillmentStatus } },
                packDiscountPercent,
                {
                    orgFeeDefaultPercent,
                    currencyRates,
                    deliveryPercent: Number(purchase.deliveryPercent ?? 0),
                },
            );
            let touched = false;
            for (const line of item.orderLines) {
                if (line.status !== 'ACTIVE') continue;
                const qty = Number(line.quantity);
                const pkgCount = Number(line.packageCount ?? 0);
                // С учётом упаковок: amountDue(qty) + packageCount * packagePrice.
                // Раньше упаковки обнулялись (calculateOrderAmount без packageCount).
                const amountDue = computeAmountDueWithPackages(qty, pkgCount, domainItem);
                const prevAmountDue = Number(line.amountDue);
                await this.orderRepo.updateAmountDue(line.id, amountDue);
                touched = true;
                if (Math.abs(amountDue - prevAmountDue) > 0.005) {
                    const agg = changedByUser.get(line.userId) ?? { prev: 0, next: 0 };
                    agg.prev += prevAmountDue;
                    agg.next += amountDue;
                    changedByUser.set(line.userId, agg);
                }
            }
            if (touched) touchedItemIds.add(item.id);
        }

        await Promise.all(Array.from(touchedItemIds).map((id) => this.eventBus.emitPurchaseItemChanged(id)));
        await this.notifyAmountRecalculated(purchase.id, purchase.tag, changedByUser);
    }

    /**
     * Пересчитать amountDue во всех закупках, где есть активные заказы.
     * Нужен после изменения глобальных настроек цен (скидка за пачку, оргсбор) —
     * записанные суммы иначе остаются в старых ценах до следующего пересчёта.
     */
    async recalculateAllAmounts(): Promise<void> {
        const purchaseIds = await this.orderRepo.findPurchaseIdsWithActiveLines();
        for (const purchaseId of purchaseIds) {
            await this.recalculateAmounts(purchaseId);
        }
    }

    private async notifyAmountRecalculated(
        purchaseId: number,
        purchaseTag: string,
        changedByUser: Map<number, { prev: number; next: number }>,
    ): Promise<void> {
        for (const [userId, agg] of changedByUser) {
            try {
                await this.notification.notify({
                    userId,
                    type: 'ORDER_AMOUNT_RECALCULATED',
                    payload: {
                        purchaseId,
                        purchaseTag,
                        prevAmountDue: Math.round(agg.prev * 100) / 100,
                        newAmountDue: Math.round(agg.next * 100) / 100,
                    },
                });
            } catch (err) {
                log.warn({ purchaseId, userId, err }, 'failed to notify about amount recalculation');
            }
        }
    }

    /**
     * Admin: установить ставки валют закупки (полная замена).
     * Курс влияет на unitPriceRub → пересчитываем amountDue всех ACTIVE заказов
     * и эмитим обновление постов в канале (через recalculateAmounts).
     */
    async setCurrencyRates(
        purchaseId: number,
        rates: { currencyId: number; rateToRub: number }[],
        deliveryPercent?: number,
    ) {
        const purchase = await this.repo.getById(purchaseId, true);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status === 'DONE') {
            throw new ValidationError('В завершённой закупке нельзя менять курсы и доставку');
        }
        await this.repo.setCurrencyRates(purchaseId, rates, deliveryPercent);
        // Курс или % доставки изменились → пересчитываем суммы заказов по новой модели цен.
        await this.recalculateAmounts(purchaseId);
        return this.repo.getCurrencyRates(purchaseId);
    }

    /**
     * Admin: установить/очистить комментарий к участнику закупки
     * (PurchaseOrder). Права гарантирует adminProcedure в роутере;
     * здесь — только проверка лимита длины и делегирование в репозиторий.
     */
    async setOrderComment(purchaseOrderId: number, comment: string, actorId: number) {
        if (comment.length > 2000) {
            throw new ValidationError('Комментарий слишком длинный (макс. 2000 символов)');
        }
        return this.repo.setOrderComment(purchaseOrderId, comment, actorId);
    }
}
