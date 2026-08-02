import {
    computeUnitPriceRubFromItem,
    NotFoundError,
    resolveOrgFeePercent,
    type CurrencyRate,
} from '@zakupki/types';
import type { EventBus } from '@zakupki/queue';

import {
    applyPostTemplate,
    productToDescriptionFields,
    type DescriptionFields,
    type ProductCharacteristicsCatalog,
} from '@/lib/product-description';
import { buildShowInTitleByTypeId } from '@/lib/product-label';

import { AttributeTypeRepository } from '../domain/attribute-type.repository';
import { CharacteristicRepository } from '../domain/characteristic.repository';
import { PostTemplateRepository } from '../domain/post-template.repository';
import { ProductAttributeRepository } from '../domain/product-attribute.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import type { PricingSettingsService } from './settings/pricing-settings';

/** Non-null форма результата PurchaseRepository.findItemForDescription. */
type ItemForDescription = NonNullable<Awaited<ReturnType<PurchaseRepository['findItemForDescription']>>>;

/**
 * Серверная регенерация описания (PurchaseItem.description) из шаблона поста.
 *
 * До этого шаблон применялся только в браузере (форма товара в закупке), и
 * изменённое тело шаблона никак не доходило до уже опубликованных постов —
 * worker читал `item.description` как есть. Этот сервис закрывает дыру: он
 * пересобирает DescriptionFields из актуальных данных товара и применяет
 * шаблон серверно, после чего эмитит ITEM_CHANGED (worker обновит пост).
 *
 * Либа `@/lib/product-description` — pure TS, server-safe (см. normalize-html
 * с `typeof window` guard), поэтому её можно использовать на сервере напрямую.
 */
export class PurchaseItemDescriptionService {
    constructor(
        private repo: PurchaseRepository,
        private attributeTypeRepo: AttributeTypeRepository,
        private characteristicRepo: CharacteristicRepository,
        private productAttributeRepo: ProductAttributeRepository,
        private postTemplateRepo: PostTemplateRepository,
        private pricingSettings: PricingSettingsService,
        private eventBus: EventBus,
    ) {}

    /**
     * Перегенерирует PurchaseItem.description из указанного шаблона с актуальными
     * данными товара и сохраняет в БД. Триггерит ITEM_CHANGED — worker обновит пост.
     *
     * @param templateId id шаблона или null («Без шаблона» → описание очищается).
     */
    async regenerateDescription(purchaseItemId: number, templateId: number | null): Promise<void> {
        const item = await this.repo.findItemForDescription(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);

        let description: string;
        if (templateId == null) {
            description = '';
        } else {
            const template = await this.postTemplateRepo.findById(templateId);
            if (!template) throw new NotFoundError('Шаблон поста', templateId);
            const fields = await this.buildDescriptionFields(item);
            description = template.body ? applyPostTemplate(template.body, fields) : '';
        }

        await this.repo.updatePurchaseItem(purchaseItemId, { description: description || null });

        // Edit поста в канале обрабатывается шиной событий — worker сам подтянет
        // актуальный description из БД и обновит пост (debounce 7s).
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
    }

    /**
     * Собирает DescriptionFields для товара из данных PurchaseItem + справочников.
     * Повторяет логику формы (purchase-product-edit-form.tsx:312-344), но серверно.
     */
    private async buildDescriptionFields(item: ItemForDescription): Promise<DescriptionFields> {
        const [attributeTypes, characteristics, productAttributes, orgFeeDefaultPercent] =
            await Promise.all([
                this.attributeTypeRepo.list(),
                this.characteristicRepo.list(),
                this.productAttributeRepo.list(),
                this.pricingSettings.getOrgFeeDefaultPercent(),
            ]);

        const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);
        const catalog: ProductCharacteristicsCatalog | undefined =
            productAttributes.length && characteristics.length
                ? { attributes: productAttributes, characteristics }
                : undefined;

        const base = productToDescriptionFields(
            item.product,
            showInTitleByTypeId,
            attributeTypes,
            catalog,
        );

        const currencyRates: CurrencyRate[] = (item.purchase.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        const orgFeePercent = resolveOrgFeePercent(
            item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
            orgFeeDefaultPercent,
        );
        const unitPriceRub = computeUnitPriceRubFromItem({
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            rateToRub:
                item.currencyId != null
                    ? (currencyRates.find((r) => r.currencyId === item.currencyId)?.rateToRub ?? null)
                    : null,
            orgFeePercent,
            packSize: item.packAmount != null ? Number(item.packAmount) : null,
        });

        const purchaseTag = item.purchase.tag ?? undefined;
        const supplierName = item.supplier?.name ?? undefined;
        const currencyName = item.currency?.name ?? undefined;

        return {
            ...base,
            name: item.product.name ?? undefined,
            // Новая модель цен (для шаблонных меток {{цена за пачку}}, {{цены}}, {{фасовка поставщика}}):
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            currencyName,
            packAmount: item.packAmount != null ? Number(item.packAmount) : null,
            packUnit: item.packUnit,
            orgFeePercent,
            unitPriceRub,
            // Добор и лимиты (для {{мин фасовка}}, {{свободно}}):
            minPackageAmount:
                item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
            minPackageUnit: item.minPackageUnit,
            supplierLimit: item.supplierLimit != null ? Number(item.supplierLimit) : null,
            supplierLimitUnit: item.supplierLimitUnit,
            // Per-purchase:
            supplierName,
            purchaseTag,
        };
    }
}
