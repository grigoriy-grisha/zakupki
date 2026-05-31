import { escapeRegExp } from '@/lib/utils/html';

export type ProductAttributeValueSource = {
    attribute: {
        name: string;
        isBrand?: boolean;
        showInTitle?: boolean;
        typeId?: number;
        parent?: { name: string; isBrand?: boolean } | null;
        type: { id?: number; name: string; position: number; showInTitle?: boolean };
    };
};

/** Актуальные флаги «в заголовок» из настроек (перекрывают вложенный type у товара из кэша). */
export type ShowInTitleByTypeId = Readonly<Record<number, boolean>>;

function attributeTypeId(v: ProductAttributeValueSource): number | undefined {
    return v.attribute.typeId ?? v.attribute.type.id;
}

export type AttributeTypeMeta = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
    showInTitle?: boolean;
};

type TypeMaps = {
    byId: Map<number, AttributeTypeMeta>;
    childrenOf: Map<number | null, AttributeTypeMeta[]>;
};

function buildTypeMaps(types: AttributeTypeMeta[]): TypeMaps {
    const byId = new Map(types.map((t) => [t.id, t]));
    const childrenOf = new Map<number | null, AttributeTypeMeta[]>();
    for (const t of types) {
        const key = t.parentId ?? null;
        const list = childrenOf.get(key) ?? [];
        list.push(t);
        childrenOf.set(key, list);
    }
    for (const list of childrenOf.values()) {
        list.sort((a, b) => a.position - b.position || a.id - b.id);
    }
    return { byId, childrenOf };
}

function buildTypeTreeOrderIndex(types: AttributeTypeMeta[]): Map<number, number> {
    const { childrenOf } = buildTypeMaps(types);
    const order = new Map<number, number>();
    let i = 0;
    function walk(parentId: number | null) {
        for (const t of childrenOf.get(parentId) ?? []) {
            order.set(t.id, i++);
            walk(t.id);
        }
    }
    walk(null);
    return order;
}

function sortAttributeValuesByTypeTree(
    values: ProductAttributeValueSource[],
    types: AttributeTypeMeta[],
): ProductAttributeValueSource[] {
    const order = buildTypeTreeOrderIndex(types);
    return [...values].sort((a, b) => {
        const ai = order.get(attributeTypeId(a) ?? -1) ?? 9999;
        const bi = order.get(attributeTypeId(b) ?? -1) ?? 9999;
        return ai - bi;
    });
}

function typeHasShowInTitle(
    typeId: number,
    maps: TypeMaps,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    if (showInTitleByTypeId && typeId in showInTitleByTypeId) {
        return showInTitleByTypeId[typeId];
    }
    const meta = maps.byId.get(typeId);
    if (meta && meta.showInTitle !== undefined) {
        return meta.showInTitle;
    }
    return true;
}

function typeOrAncestorShowsInTitle(
    typeId: number,
    maps: TypeMaps,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    let current: number | null = typeId;
    while (current != null) {
        if (typeHasShowInTitle(current, maps, showInTitleByTypeId)) return true;
        current = maps.byId.get(current)?.parentId ?? null;
    }
    return false;
}

function hasDescendantWithShowInTitle(
    typeId: number,
    maps: TypeMaps,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    for (const child of maps.childrenOf.get(typeId) ?? []) {
        if (typeHasShowInTitle(child.id, maps, showInTitleByTypeId)) return true;
        if (hasDescendantWithShowInTitle(child.id, maps, showInTitleByTypeId)) return true;
    }
    return false;
}

function isShowInTitle(
    v: ProductAttributeValueSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): boolean {
    const typeId = attributeTypeId(v);
    if (typeId == null) {
        if (showInTitleByTypeId) return false;
        return v.attribute.type.showInTitle !== false;
    }

    if (!attributeTypes?.length) {
        if (showInTitleByTypeId && typeId in showInTitleByTypeId) {
            return showInTitleByTypeId[typeId];
        }
        return v.attribute.type.showInTitle !== false;
    }

    const maps = buildTypeMaps(attributeTypes);
    if (typeOrAncestorShowsInTitle(typeId, maps, showInTitleByTypeId)) return true;
    if (hasDescendantWithShowInTitle(typeId, maps, showInTitleByTypeId)) return true;
    return false;
}

export type ProductCharacteristicValueSource = {
    value: string;
    characteristic: { name: string; position?: number };
};

export type ProductLabelSource = {
    name: string;
    articleNumber?: string | null;
    brand?: { name: string; typeId?: number; showInTitle?: boolean; isBrand?: boolean } | null;
    attributeValues?: ProductAttributeValueSource[];
    characteristicValues?: ProductCharacteristicValueSource[];
    photos?: { id: number }[];
};

function formatAttributeValueName(v: ProductAttributeValueSource): string {
    const name = v.attribute.name?.trim();
    if (!name) return '';
    const parentName = v.attribute.parent?.name?.trim();
    if (parentName && !v.attribute.isBrand) {
        const separator = v.attribute.parent?.isBrand ? ' ' : ' / ';
        return `${parentName}${separator}${name}`;
    }
    return name;
}

function buildValuesByTypeId(
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

function orderedValues(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): ProductAttributeValueSource[] {
    const values = product.attributeValues ?? [];
    if (attributeTypes?.length) {
        return sortAttributeValuesByTypeTree(values, attributeTypes);
    }
    return [...values].sort((a, b) => a.attribute.type.position - b.attribute.type.position);
}

/** Все значения атрибутов товара по порядку дерева типов. */
export function getProductAttributeNames(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    return orderedValues(product, attributeTypes)
        .map((v) => formatAttributeValueName(v))
        .filter((n): n is string => Boolean(n));
}

/** Подписи атрибутов для каталога: «Тип: Бренд Значение» по дереву типов. */
export function getProductCatalogAttributeLabels(
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

function hasSelectedValueInDescendant(
    typeId: number,
    valuesByTypeId: Map<number, ProductAttributeValueSource>,
    maps: TypeMaps,
): boolean {
    for (const child of maps.childrenOf.get(typeId) ?? []) {
        if (valuesByTypeId.has(child.id)) return true;
        if (hasSelectedValueInDescendant(child.id, valuesByTypeId, maps)) return true;
    }
    return false;
}

function hasAncestorWithSelectedValue(
    typeId: number,
    valuesByTypeId: Map<number, ProductAttributeValueSource>,
    maps: TypeMaps,
): boolean {
    let parentId = maps.byId.get(typeId)?.parentId ?? null;
    while (parentId != null) {
        if (valuesByTypeId.has(parentId)) return true;
        parentId = maps.byId.get(parentId)?.parentId ?? null;
    }
    return false;
}

function shouldIncludeTypeNameInTitle(
    typeId: number,
    maps: TypeMaps,
    valuesByTypeId: Map<number, ProductAttributeValueSource>,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    if (!typeHasShowInTitle(typeId, maps, showInTitleByTypeId)) return false;
    if (valuesByTypeId.has(typeId)) return false;
    if (!hasSelectedValueInDescendant(typeId, valuesByTypeId, maps)) return false;
    if (hasAncestorWithSelectedValue(typeId, valuesByTypeId, maps)) return false;
    return true;
}

/** Тип или его предок/потомок участвует в первой строке заголовка. */
function isTypeInTitleBranch(
    typeId: number,
    maps: TypeMaps,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    return (
        typeHasShowInTitle(typeId, maps, showInTitleByTypeId) ||
        typeOrAncestorShowsInTitle(typeId, maps, showInTitleByTypeId) ||
        hasDescendantWithShowInTitle(typeId, maps, showInTitleByTypeId)
    );
}

/** Значения атрибутов с флагом «показывать в заголовке описания» по порядку дерева типов. */
export function getProductTitleAttributeNames(
    product: ProductLabelSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    if (!attributeTypes?.length) {
        return orderedValues(product, attributeTypes)
            .filter((v) => isShowInTitle(v, showInTitleByTypeId, attributeTypes) && attributeValueShowsInTitle(v.attribute))
            .map((v) => v.attribute.name?.trim())
            .filter((n): n is string => Boolean(n));
    }

    const maps = buildTypeMaps(attributeTypes);
    const valuesByTypeId = new Map<number, ProductAttributeValueSource>();
    for (const v of orderedValues(product, attributeTypes)) {
        const id = attributeTypeId(v);
        if (id != null) valuesByTypeId.set(id, v);
    }

    const parts: string[] = [];

    function walk(parentId: number | null) {
        for (const type of maps.childrenOf.get(parentId) ?? []) {
            const val = valuesByTypeId.get(type.id);
            const valueName = val?.attribute.name?.trim();
            const attributeInTitle = attributeValueShowsInTitle(val?.attribute);
            const typeInTitle = typeHasShowInTitle(type.id, maps, showInTitleByTypeId);
            const inBranch = isTypeInTitleBranch(type.id, maps, showInTitleByTypeId);

            // Тип с галочкой и выбранным значением: «Miyuki Delica 11/0»
            if (typeInTitle && valueName && attributeInTitle) {
                const typeLabel = type.name.trim();
                if (typeLabel) parts.push(typeLabel);
                parts.push(valueName);
            } else if (shouldIncludeTypeNameInTitle(type.id, maps, valuesByTypeId, showInTitleByTypeId)) {
                const label = type.name.trim();
                if (label) parts.push(label);
            } else if (valueName && inBranch && attributeInTitle) {
                parts.push(valueName);
            }

            walk(type.id);
        }
    }

    walk(null);
    return parts;
}

export function buildShowInTitleByTypeId(
    types: { id: number; showInTitle: boolean }[] | undefined,
): ShowInTitleByTypeId | undefined {
    if (!types?.length) return undefined;
    return Object.fromEntries(types.map((t) => [t.id, t.showInTitle]));
}

/** Подпись: MIYUKI · Delica 11/0 · Цилиндр · 11/0 · DB-0002 */
export function formatProductAttributesLine(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): string {
    const attrNames = getProductAttributeNames(product, attributeTypes);
    const brandName = product.brand?.name?.trim() || null;
    const parts =
        brandName && !attrNames.some((n) => n === brandName || n.startsWith(`${brandName} `) || n.startsWith(`${brandName} /`))
            ? [brandName, ...attrNames]
            : attrNames;
    return [...parts, product.articleNumber?.trim() || null]
        .filter((p): p is string => Boolean(p))
        .join(' · ');
}

export type ProductCatalogCardSource = ProductLabelSource & {
    unit?: { name: string; shortName: string } | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
};

/** Строки полного описания для карточки товара в каталоге. */
export function formatProductCatalogCardLines(
    product: ProductCatalogCardSource,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    const lines: string[] = [];
    const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);

    const title = getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
    if (title) lines.push(title);

    const article = product.articleNumber?.trim() ?? '';
    const displayName = (getProductDisplayName(product) || product.name?.trim() || '').trim();
    const nameLine = [article, displayName].filter(Boolean).join(' ');
    if (nameLine) lines.push(nameLine);

    const attributeLabels = getProductCatalogAttributeLabels(product, attributeTypes);
    if (attributeLabels.length > 0) {
        lines.push(attributeLabels.join(' · '));
    } else {
        const attributesLine = formatProductAttributesLine(product, attributeTypes);
        if (attributesLine) lines.push(attributesLine);
    }

    for (const cv of product.characteristicValues ?? []) {
        const name = cv.characteristic.name?.trim();
        const value = cv.value?.trim();
        if (name && value) lines.push(`${name}: ${value}`);
    }

    if (product.unit?.name) {
        const unitLabel = product.unit.shortName
            ? `${product.unit.name} (${product.unit.shortName})`
            : product.unit.name;
        lines.push(`Ед. учёта: ${unitLabel}`);
    }

    if (product.minPackageAmount != null && product.minPackageUnit) {
        lines.push(`Мин. фасовка: ${Number(product.minPackageAmount)} ${product.minPackageUnit}`);
    }

    return lines.map((l) => l.trim()).filter(Boolean);
}

/** Две строки для списка товаров в закупке: заголовок и «номер название». */
export function formatPurchaseProductLabel(
    product: ProductLabelSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): { line1: string; line2: string; text: string } {
    const article = product.articleNumber?.trim() ?? '';
    const title = getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
    const displayName = (getProductDisplayName(product) || product.name?.trim() || '').trim();

    const line1 = title;

    const line2Parts: string[] = [];
    if (article) line2Parts.push(article);
    if (displayName) line2Parts.push(displayName);
    const line2 = line2Parts.join(' ');

    return {
        line1,
        line2,
        text: [line1, line2].filter(Boolean).join('\n'),
    };
}

export function getProductPhotoId(product: ProductLabelSource): number | null {
    return product.photos?.[0]?.id ?? null;
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
