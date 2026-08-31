import { buildTypeMaps, buildShowInTitleByTypeId } from './type-tree';
import {
    orderedValues,
    formatAttributeValueName,
    formatProductAttributesLine,
    buildValuesByTypeId,
    getProductAttributeNames,
    getProductDisplayName,
    isShowInTitle,
    attributeValueShowsInTitle,
} from './format-attributes';
import { getProductTitleAttributeNames } from './format-title';
import { getPurchaseProductSubtitleLine } from './format-purchase';
import type {
    ProductLabelSource,
    ProductCatalogCardSource,
    AttributeTypeMeta,
    CatalogCardLine,
    ShopItemDescriptionRow,
} from './types';

function getProductCatalogAttributeLabels(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    if (!attributeTypes?.length) {
        return getProductAttributeNames(product);
    }

    const maps = buildTypeMaps(attributeTypes);
    const valuesByTypeId = buildValuesByTypeId(product, attributeTypes);
    const labels: string[] = [];

    function walk(parentId: number | null) {
        for (const type of maps.childrenOf.get(parentId) ?? []) {
            const val = valuesByTypeId.get(type.id);
            if (val) {
                const valueLabel = formatAttributeValueName(val);
                if (valueLabel) labels.push(`${type.name}: ${valueLabel}`);
            }
            walk(type.id);
        }
    }

    walk(null);
    return labels;
}

export function formatProductCatalogCardLines(
    product: ProductCatalogCardSource,
    attributeTypes?: AttributeTypeMeta[],
): CatalogCardLine[] {
    const lines: CatalogCardLine[] = [];
    const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);

    const article = product.articleNumber?.trim() ?? '';
    const displayName = (getProductDisplayName(product) || product.name?.trim() || '').trim();
    const nameLine = [article, displayName].filter(Boolean).join(' ');
    if (nameLine) lines.push({ text: nameLine, role: 'name' });

    const title = getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
    if (title) lines.push({ text: title, role: 'title' });

    const attributeLabels = getProductCatalogAttributeLabels(product, attributeTypes);
    if (attributeLabels.length > 0) {
        lines.push({ text: attributeLabels.join(' · '), role: 'meta' });
    } else {
        const attributesLine = formatProductAttributesLine(product, attributeTypes);
        if (attributesLine) lines.push({ text: attributesLine, role: 'meta' });
    }

    for (const cv of product.characteristicValues ?? []) {
        const name = cv.characteristic.name?.trim();
        const value = cv.value?.trim();
        if (name && value) lines.push({ text: `${name}: ${value}`, role: 'meta' });
    }

    if (product.unit?.name) {
        const unitLabel = product.unit.shortName
            ? `${product.unit.name} (${product.unit.shortName})`
            : product.unit.name;
        lines.push({ text: `Ед. учёта: ${unitLabel}`, role: 'meta' });
    }

    return lines.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text.length > 0);
}

export function buildShopItemDescriptionRows(
    product: ProductCatalogCardSource,
    attributeTypes?: AttributeTypeMeta[],
): ShopItemDescriptionRow[] {
    const rows: ShopItemDescriptionRow[] = [];
    const subtitle = getPurchaseProductSubtitleLine(product, attributeTypes);
    const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);

    for (const v of orderedValues(product, attributeTypes)) {
        if (v.attribute.isBrand) continue;
        const typeName = v.attribute.type?.name?.trim();
        const value = v.attribute.name?.trim() ?? '';
        if (!typeName || !value || typeName === 'Производитель') continue;

        const formatted = formatAttributeValueName(v);
        const combined = `${typeName} ${value}`;

        if (isShowInTitle(v, showInTitleByTypeId, attributeTypes) && attributeValueShowsInTitle(v.attribute)) {
            continue;
        }

        if (subtitle) {
            if (formatted === subtitle || combined === subtitle || value === subtitle) continue;
            if (v.attribute.parent?.isBrand && formatted && subtitle.includes(formatted)) continue;
        }

        rows.push({ label: typeName, value });
    }

    for (const cv of product.characteristicValues ?? []) {
        const name = cv.characteristic.name?.trim();
        const value = cv.value?.trim();
        if (name && value) rows.push({ label: name, value });
    }

    if (product.unit?.name) {
        const unitLabel = product.unit.shortName
            ? `${product.unit.name} (${product.unit.shortName})`
            : product.unit.name;
        rows.push({ label: 'Единица', value: unitLabel });
    }

    if (product.minPackageAmount != null && product.minPackageUnit) {
        rows.push({
            label: 'Мин. фасовка',
            value: `${Number(product.minPackageAmount)} ${product.minPackageUnit}`,
        });
    }

    return rows;
}
