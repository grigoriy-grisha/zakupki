import { escapeRegExp } from '@/lib/utils/html';

import { attributeTypeId, buildTypeMaps, sortAttributeValuesByTypeTree, buildShowInTitleByTypeId, isShowInTitle } from './type-tree';
import type {
    ProductAttributeValueSource,
    AttributeTypeMeta,
    ShowInTitleByTypeId,
    ProductLabelSource,
} from './types';

/** Форматирует значение атрибута: «Бренд Значение» или «Родитель / Значение». */
export function formatAttributeValueName(v: ProductAttributeValueSource): string {
    const name = v.attribute.name?.trim();
    if (!name) return '';
    const parentName = v.attribute.parent?.name?.trim();
    if (parentName && !v.attribute.isBrand) {
        const separator = v.attribute.parent?.isBrand ? ' ' : ' / ';
        return `${parentName}${separator}${name}`;
    }
    return name;
}

/** Упорядоченные значения атрибутов товара по дереву типов. */
export function orderedValues(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): ProductAttributeValueSource[] {
    const values = product.attributeValues ?? [];
    if (attributeTypes?.length) {
        return sortAttributeValuesByTypeTree(values, attributeTypes);
    }
    return [...values].sort((a, b) => a.attribute.type.position - b.attribute.type.position);
}

export function buildValuesByTypeId(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): Map<number, ProductAttributeValueSource> {
    const map = new Map<number, ProductAttributeValueSource>();
    for (const v of orderedValues(product, attributeTypes)) {
        const typeId = attributeTypeId(v);
        if (typeId != null) map.set(typeId, v);
    }

    const brand = product.brand;
    const brandTypeId = brand?.typeId;
    const brandName = brand?.name?.trim();
    if (brandTypeId != null && brandName && !map.has(brandTypeId)) {
        const typeMeta = attributeTypes?.find((t) => t.id === brandTypeId);
        map.set(brandTypeId, {
            attribute: {
                name: brandName,
                isBrand: true,
                typeId: brandTypeId,
                type: {
                    id: brandTypeId,
                    name: typeMeta?.name ?? '',
                    position: typeMeta?.position ?? 0,
                },
            },
        });
    }

    return map;
}

function brandShowsInTitle(brand: ProductLabelSource['brand']): boolean {
    if (!brand?.name?.trim()) return false;
    return brand.showInTitle !== false;
}

function attributeValueShowsInTitle(attr: ProductAttributeValueSource['attribute'] | undefined): boolean {
    if (!attr?.isBrand) return true;
    return attr.showInTitle !== false;
}

/** Все значения атрибутов товара по порядку дерева типов. */
export function getProductAttributeNames(product: ProductLabelSource, attributeTypes?: AttributeTypeMeta[]): string[] {
    return orderedValues(product, attributeTypes)
        .map((v) => formatAttributeValueName(v))
        .filter((n): n is string => Boolean(n));
}

/** Подпись: MIYUKI · Delica 11/0 · Цилиндр · 11/0 · DB-0002 */
export function formatProductAttributesLine(product: ProductLabelSource, attributeTypes?: AttributeTypeMeta[]): string {
    const attrNames = getProductAttributeNames(product, attributeTypes);
    const brandName = product.brand?.name?.trim() || null;
    const parts =
        brandName &&
        !attrNames.some((n) => n === brandName || n.startsWith(`${brandName} `) || n.startsWith(`${brandName} /`))
            ? [brandName, ...attrNames]
            : attrNames;
    return [...parts, product.articleNumber?.trim() || null].filter((p): p is string => Boolean(p)).join(' · ');
}

/** Только название товара без атрибутов, номера и т.д. */
export function getProductDisplayName(product: ProductLabelSource): string {
    return stripAttributesFromName(product.name ?? '', product.articleNumber, getProductAttributeNames(product));
}

/** Убирает из названия значения атрибутов и артикул, оставляя «чистое» имя. */
export function stripAttributesFromName(
    name: string,
    articleNumber: string | null | undefined,
    attributeNames: string[],
): string {
    const raw = (name ?? '').trim();
    if (!raw) return '';

    const article = articleNumber?.trim();
    const lines = raw
        .split(/\r?\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length >= 2) {
        let candidate = lines[lines.length - 1];
        if (article) {
            candidate = candidate.replace(new RegExp(`^${escapeRegExp(article)}\\s*`, 'i'), '').trim();
        }
        if (candidate) return candidate;
    }

    const tokens = [...attributeNames, article].filter((t): t is string => Boolean(t?.trim()));

    let rest = raw;
    for (const token of tokens) {
        const re = new RegExp(`^${escapeRegExp(token)}\\s*`, 'i');
        if (re.test(rest)) {
            rest = rest.replace(re, '').trim();
        }
    }

    return stripArticlePrefix(rest, article) || raw;
}

function stripArticlePrefix(text: string, article?: string): string {
    if (!article) return text.trim();
    return text.replace(new RegExp(`^${escapeRegExp(article)}\\s*`, 'i'), '').trim();
}

export function getProductPhotoId(product: ProductLabelSource): number | null {
    return product.photos?.[0]?.id ?? null;
}

export { buildShowInTitleByTypeId, isShowInTitle, attributeValueShowsInTitle, brandShowsInTitle, attributeTypeId };
