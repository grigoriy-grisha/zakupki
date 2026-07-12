import { computeAmountDueWithPackages, mapToPurchaseItem, NotFoundError, ValidationError } from '@zakupki/types';

import { formatPurchaseTag } from '../domain/product-purchase-lock';
import { OrderRepository } from '../domain/order.repository';
import { ProductRepository } from '../domain/product.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { handleDbConflict } from '../lib/error-utils';
import type { EventBus } from '@zakupki/queue';
import type { PricingSettingsService } from './settings/pricing-settings';
import type { TelegramPublishService } from './telegram-publish.service';

export class PurchaseService {
    constructor(
        private repo: PurchaseRepository,
        private productRepo: ProductRepository,
        private telegramPublish: TelegramPublishService,
        private orderRepo: OrderRepository,
        private eventBus: EventBus,
        private pricingSettings: PricingSettingsService,
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
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'DRAFT') {
            throw new ValidationError('Удалить можно только черновик');
        }
        const deleted = await this.repo.deleteDraft(id);
        if (!deleted) throw new NotFoundError('Закупка', id);
        return deleted;
    }

    async findItemsToPublish(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
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

    /**
     * Применяет partial-обновление к PurchaseItem. Вся per-purchase конкретика
     * (описание, цены, фасовка, supplier) теперь редактируется здесь. Product
     * больше не трогается — он хранит только каталожные данные.
     */
    async updateItemProduct(
        purchaseItemId: number,
        itemData: Record<string, unknown>,
        priceOverride: number | null,
    ) {
        const item = await this.repo.findItemWithProductAndTg(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);

        // Собираем partial update PurchaseItem за один round-trip.
        // Только поля, которые явно пришли из формы (не undefined).
        const itemUpdate: Record<string, unknown> = { priceOverride };
        const allowedKeys = [
            'supplierId',
            'description',
            'pricePerUnit',
            'priceTiers',
            'minPackageAmount',
            'minPackageUnit',
            'supplierPackageAmount',
            'supplierPackageUnit',
            'supplierPackagePrice',
            'supplierPackageTiers',
            'supplementStep',
            'supplierLimit',
            'supplierLimitUnit',
            'targetRemainder',
        ] as const;
        for (const key of allowedKeys) {
            if (itemData[key] !== undefined) itemUpdate[key] = itemData[key];
        }

        await this.repo.updatePurchaseItem(purchaseItemId, itemUpdate);

        // Emit в шину доменных событий (попадает в debounce-окно 7s).
        // Воркер в боте сам подтянет актуальные данные из БД и обновит пост в канале.
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);

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
            pricePerUnit?: number | null;
            priceTiers?: unknown;
            minPackageAmount?: number | null;
            minPackageUnit?: string | null;
            supplierPackageAmount?: number | null;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: number | null;
            supplierPackageTiers?: unknown;
            supplementStep?: number | null;
        }[],
    ) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status === 'DONE') {
            throw new ValidationError('В завершённую закупку нельзя добавлять товары');
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

        const created = [];
        for (const config of toCreate) {
            const item = await this.repo.addItem(purchaseId, config);
            created.push(item);
        }

        return {
            items: created,
            skippedCount: items.length - created.length,
        };
    }

    async removeItem(id: number) {
        const item = await this.repo.findItemWithPurchase(id);
        if (!item) throw new NotFoundError('Позиция закупки', id);

        if (item.tgMessageId) {
            await this.telegramPublish.enqueueDeleteChannelPost(id);
        }

        return this.repo.removeItem(id);
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
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);

        const packDiscountPercent = await this.pricingSettings.getBeadPackPriceDiscountPercent();
        const touchedItemIds = new Set<number>();
        for (const item of purchase.items) {
            // Доменный PurchaseItem для canonical-прайсинга. getById не вкладывает
            // purchase в каждый item — инжектим fulfillmentStatus из родителя.
            const domainItem = mapToPurchaseItem(
                { ...item, purchase: { fulfillmentStatus: purchase.fulfillmentStatus } },
                packDiscountPercent,
            );
            let touched = false;
            for (const line of item.orderLines) {
                if (line.status !== 'ACTIVE') continue;
                const qty = Number(line.quantity);
                const pkgCount = Number(line.packageCount ?? 0);
                // С учётом упаковок: amountDue(qty) + packageCount * packagePrice.
                // Раньше упаковки обнулялись (calculateOrderAmount без packageCount).
                const amountDue = computeAmountDueWithPackages(qty, pkgCount, domainItem);
                await this.orderRepo.updateAmountDue(line.id, amountDue);
                touched = true;
            }
            if (touched) touchedItemIds.add(item.id);
        }

        await Promise.all(Array.from(touchedItemIds).map((id) => this.eventBus.emitPurchaseItemChanged(id)));
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
