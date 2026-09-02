import type { EventBus } from '@zakupki/queue';
import {
    computeUnitPriceRubFromItem,
    type CurrencyRate,
    NotFoundError,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
} from '@zakupki/types';

import {
    type DescriptionFields,
    postTemplateEngine,
    type ProductCharacteristicsCatalog,
    productDescriptionBuilder,
} from '@/lib/product-description';
import { buildShowInTitleByTypeId } from '@/lib/product-label';

import type { AttributeTypeRepository } from '../domain/attribute-type.repository';
import type { CharacteristicRepository } from '../domain/characteristic.repository';
import type { PostTemplateRepository } from '../domain/post-template.repository';
import type { ProductAttributeRepository } from '../domain/product-attribute.repository';
import type { PurchaseRepository } from '../domain/purchase.repository';
import type { PricingSettingsService } from './settings/pricing-settings';

type ItemForDescription = NonNullable<Awaited<ReturnType<PurchaseRepository['findItemForDescription']>>>;

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
            description = template.body ? postTemplateEngine.apply(template.body, fields) : '';
        }

        await this.repo.updatePurchaseItem(purchaseItemId, { description: description || null });
        await this.eventBus.emitPurchaseItemChanged(purchaseItemId);
    }

    private async buildDescriptionFields(item: ItemForDescription): Promise<DescriptionFields> {
        const [attributeTypes, characteristics, productAttributes, orgFeeDefaultPercent] = await Promise.all([
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

        const base = productDescriptionBuilder.fromProduct(item.product, showInTitleByTypeId, attributeTypes, catalog);

        const currencyRates: CurrencyRate[] = (item.purchase.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        }));
        const orgFeePercent = resolveOrgFeePercent(
            item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
            orgFeeDefaultPercent,
        );
        const deliveryPercent = resolveDeliveryPercent(
            item.deliveryPercentOverride != null ? Number(item.deliveryPercentOverride) : null,
            Number(item.purchase.deliveryPercent ?? 0),
        );
        const unitPriceRub = computeUnitPriceRubFromItem({
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            rateToRub:
                item.currencyId != null
                    ? (currencyRates.find((r) => r.currencyId === item.currencyId)?.rateToRub ?? null)
                    : null,
            orgFeePercent,
            deliveryPercent,
            packSize: item.packAmount != null ? Number(item.packAmount) : null,
        });

        const purchaseTag = item.purchase.tag ?? undefined;
        const supplierName = item.supplier?.name ?? undefined;
        const currencyName = item.currency?.name ?? undefined;

        return {
            ...base,
            name: item.product.name ?? undefined,
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            currencyName,
            packAmount: item.packAmount != null ? Number(item.packAmount) : null,
            packUnit: item.packUnit,
            orgFeePercent,
            unitPriceRub,
            minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
            minPackageUnit: item.minPackageUnit,
            supplierLimit: item.supplierLimit != null ? Number(item.supplierLimit) : null,
            supplierLimitUnit: item.supplierLimitUnit,
            supplierName,
            purchaseTag,
        };
    }
}
