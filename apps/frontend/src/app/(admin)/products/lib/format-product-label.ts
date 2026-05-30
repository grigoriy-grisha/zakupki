export type ProductAttributeValueSource = {
    attribute: {
        name: string;
        typeId?: number;
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
    attributeValues?: ProductAttributeValueSource[];
    characteristicValues?: ProductCharacteristicValueSource[];
    photos?: { id: number }[];
};

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
        .map((v) => v.attribute.name?.trim())
        .filter((n): n is string => Boolean(n));
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
            .filter((v) => isShowInTitle(v, showInTitleByTypeId, attributeTypes))
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
            const typeInTitle = typeHasShowInTitle(type.id, maps, showInTitleByTypeId);
            const inBranch = isTypeInTitleBranch(type.id, maps, showInTitleByTypeId);

            // Тип с галочкой и выбранным значением: «Miyuki Delica 11/0»
            if (typeInTitle && valueName) {
                const typeLabel = type.name.trim();
                if (typeLabel) parts.push(typeLabel);
                parts.push(valueName);
            } else if (shouldIncludeTypeNameInTitle(type.id, maps, valuesByTypeId, showInTitleByTypeId)) {
                const label = type.name.trim();
                if (label) parts.push(label);
            } else if (valueName && inBranch) {
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
export function formatProductAttributesLine(product: ProductLabelSource): string {
    return [...getProductAttributeNames(product), product.articleNumber?.trim() || null]
        .filter((p): p is string => Boolean(p))
        .join(' · ');
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

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
