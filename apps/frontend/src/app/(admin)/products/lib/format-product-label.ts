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
    const valuesByTypeId = buildValuesByTypeId(product, attributeTypes);

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
    types: Pick<AttributeTypeMeta, 'id' | 'showInTitle'>[] | undefined,
): ShowInTitleByTypeId | undefined {
    if (!types?.length) return undefined;
    return Object.fromEntries(types.map((t) => [t.id, t.showInTitle !== false]));
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

export type CatalogCardLineRole = 'title' | 'name' | 'meta';

export type CatalogCardLine = {
    text: string;
    role: CatalogCardLineRole;
};

/** Строки полного описания для карточки товара в каталоге. */
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

function formatPurchaseProductLine1(product: ProductLabelSource): string {
    const article = product.articleNumber?.trim() ?? '';
    const displayName = (getProductDisplayName(product) || product.name?.trim() || '').trim();

    if (article && displayName) return `${article} ${displayName}`;
    return article || displayName;
}

/** Части второй строки заголовка: все атрибуты «в заголовок» по дереву типов. */
function getPurchaseProductSubtitleParts(
    product: ProductLabelSource,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    const showInTitleByTypeId = buildShowInTitleByTypeId(attributeTypes);
    return getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes)
        .map((part) => part.trim())
        .filter(Boolean);
}

function getPurchaseProductSubtitleLine(
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

export type ShopItemDescriptionRow = { label: string; value: string };

/** Строки характеристик на странице товара в магазине (без дубля подзаголовка). */
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

        if (
            isShowInTitle(v, showInTitleByTypeId, attributeTypes) &&
            attributeValueShowsInTitle(v.attribute)
        ) {
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
