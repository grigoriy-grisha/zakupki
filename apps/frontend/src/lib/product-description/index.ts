import type { ProductLabelSource } from '@/lib/product-label';
import type { AttributeTypeMeta, ShowInTitleByTypeId } from '@/lib/product-label';
import { getProductAttributeNames, getProductTitleAttributeNames } from '@/lib/product-label';
import {
    resolveProductCharacteristics,
    type AttributeListItem,
    type ProductCharacteristicsSource,
} from '@/lib/product-form-utils';

export type { DescriptionFields } from './types';

export { buildProductDescriptionText } from './build-text';
export { buildDescriptionHtml } from './build-html';
export { applyPostTemplate, stripPlaceholderHintDebris, POST_TEMPLATE_PLACEHOLDERS, findUnknownPlaceholders } from './template-engine';
export { normalizeNovelHtml } from './normalize-html';

export type ProductCharacteristicsCatalog = {
    attributes: AttributeListItem[];
    characteristics: { id: number; name: string }[];
};

export function productToDescriptionFields(
    product: ProductLabelSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
    catalog?: ProductCharacteristicsCatalog,
): Omit<import('./types').DescriptionFields, 'name'> {
    return {
        articleNumber: product.articleNumber ?? undefined,
        brandName: getProductBrandName(product) || undefined,
        titleAttributes: getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes),
        attributeNames: getProductAttributeNames(product, attributeTypes),
        productCharacteristics: getProductCharacteristics(product, catalog, attributeTypes),
    };
}

function getProductBrandName(product: ProductLabelSource): string {
    const fromRelation = product.brand?.name?.trim();
    if (fromRelation) return fromRelation;
    for (const v of product.attributeValues ?? []) {
        if (v.attribute.isBrand) {
            const name = v.attribute.name?.trim();
            if (name) return name;
        }
    }
    return '';
}

function getProductCharacteristics(
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
