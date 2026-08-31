import {
    getProductAttributeNames,
    getProductTitleAttributeNames,
    stripAttributesFromName,
    type AttributeTypeMeta,
    type ProductLabelSource,
    type ShowInTitleByTypeId,
} from '@/lib/product-label';
import {
    resolveProductCharacteristics,
    type AttributeListItem,
    type ProductCharacteristicsSource,
} from '@/lib/product-form-utils';
import { formatNumber, isPositive } from '@/lib/utils/format';

import type { DescriptionFields } from './types';
import { normalizeNovelHtml } from './normalize-html';
import { blankParagraph, boldLinesParagraph, boldParagraph, linesParagraph, paragraph } from './paragraphs';
import { formatStockLine } from './stock-line';

export type ProductCharacteristicsCatalog = {
    attributes: AttributeListItem[];
    characteristics: { id: number; name: string }[];
};

export class ProductDescriptionBuilder {
    fromProduct(
        product: ProductLabelSource,
        showInTitleByTypeId?: ShowInTitleByTypeId,
        attributeTypes?: AttributeTypeMeta[],
        catalog?: ProductCharacteristicsCatalog,
    ): Omit<DescriptionFields, 'name'> {
        return {
            articleNumber: product.articleNumber ?? undefined,
            brandName: this.getProductBrandName(product) || undefined,
            titleAttributes: getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes),
            attributeNames: getProductAttributeNames(product, attributeTypes),
            productCharacteristics: this.getProductCharacteristics(product, catalog, attributeTypes),
        };
    }

    buildHtml(input: DescriptionFields): string {
        const blocks: string[] = [];
        const article = (input.articleNumber ?? '').trim();
        const displayName = stripAttributesFromName(input.name ?? '', input.articleNumber, input.attributeNames ?? []);

        const line1 = (input.titleAttributes ?? [])
            .map((s) => s.trim())
            .filter(Boolean)
            .join(' ');
        const line2Parts: string[] = [];
        if (article) line2Parts.push(article);
        if (displayName) line2Parts.push(displayName);
        const line2 = line2Parts.length ? line2Parts.join('  ') : '';

        const headerLines = [line1, line2].filter(Boolean);
        if (headerLines.length) blocks.push(boldLinesParagraph(headerLines));

        const chars = input.productCharacteristics?.filter((c) => c.name && c.value) ?? [];
        if (chars.length > 0) {
            blocks.push(blankParagraph());
            blocks.push(linesParagraph(chars.map((c) => `${c.name}: ${c.value}`)));
        }

        if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
            blocks.push(blankParagraph());
            blocks.push(
                boldParagraph(`Минимальная фасовка  - ${formatNumber(input.minPackageAmount)} ${input.minPackageUnit}`),
            );
        }

        const stockLine = formatStockLine(input);
        if (stockLine) {
            blocks.push(blankParagraph());
            blocks.push(paragraph(`СВОБОДНО: ${stockLine}`));
        }

        return normalizeNovelHtml(blocks.join(''));
    }

    private getProductBrandName(product: ProductLabelSource): string {
        const fromRelation = product.brand?.name?.trim();
        if (fromRelation) return fromRelation;
        for (const v of product.attributeValues ?? []) {
            if (v.attribute.isBrand) {
                const name = v.attribute.name?.trim();
                if (name) return name;
            }
            const parent = v.attribute.parent;
            if (parent?.isBrand) {
                const parentName = parent.name?.trim();
                if (parentName) return parentName;
            }
        }
        return '';
    }

    private getProductCharacteristics(
        product: ProductLabelSource,
        catalog?: ProductCharacteristicsCatalog,
        attributeTypes?: AttributeTypeMeta[],
    ): { name: string; value: string }[] {
        if (catalog?.attributes.length && catalog.characteristics.length && attributeTypes?.length) {
            return resolveProductCharacteristics(
                product as ProductCharacteristicsSource,
                catalog.attributes,
                attributeTypes,
                catalog.characteristics,
            );
        }
        return (product.characteristicValues ?? [])
            .map((v) => ({
                name: v.characteristic.name?.trim() ?? '',
                value: v.value?.trim() ?? '',
            }))
            .filter((c) => c.name && c.value);
    }
}

export const productDescriptionBuilder = new ProductDescriptionBuilder();
