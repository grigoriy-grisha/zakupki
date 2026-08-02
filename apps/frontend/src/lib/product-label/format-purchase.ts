import { buildShowInTitleByTypeId } from './type-tree';
import { getProductDisplayName, formatProductAttributesLine } from './format-attributes';
import { getProductTitleAttributeNames } from './format-title';
import type { ProductLabelSource, AttributeTypeMeta, ShowInTitleByTypeId } from './types';

function formatPurchaseProductLine1(product: ProductLabelSource): string {
    const article = product.articleNumber?.trim() ?? '';
    const displayName = (getProductDisplayName(product) || product.name?.trim() || '').trim();

    if (article && displayName) return `${article} ${displayName}`;
    return article || displayName;
}

/** Части второй строки заголовка: все атрибуты «в заголовок» по дереву типов. */
function getPurchaseProductSubtitleParts(product: ProductLabelSource, attributeTypes?: AttributeTypeMeta[]): string[] {
    const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);
    return getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes)
        .map((part) => part.trim())
        .filter(Boolean);
}

export function getPurchaseProductSubtitleLine(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): string {
    const parts = getPurchaseProductSubtitleParts(product, attributeTypes);
    if (parts.length > 0) return parts.join(' ');

    const brandName = product.brand?.name?.trim() ?? '';
    if (brandName) return brandName;

    const attrLine = formatProductAttributesLine(product, attributeTypes);
    if (attrLine) return attrLine.replace(/\s*·\s*/g, ' ');

    return '';
}

/** Две строки для таблицы «Товары в закупке»: «номер название» и бренд/тип. */
export function formatPurchaseProductLabel(
    product: ProductLabelSource,
    _showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): { lines: string[]; line1: string; line2: string; text: string } {
    const line1 = formatPurchaseProductLine1(product);
    const line2 = getPurchaseProductSubtitleLine(product, attributeTypes);
    const lines = [line1, line2].filter(Boolean);

    return {
        lines,
        line1: lines[0] ?? '',
        line2: lines[1] ?? '',
        text: lines.join('\n'),
    };
}
