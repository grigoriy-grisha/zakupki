export type AttributeListItem = {
    id: number;
    typeId: number;
    name: string;
    isBrand?: boolean;
    parentId?: number | null;
    characteristics?: { position?: number; characteristic: { id: number } }[];
};

export type PendingFile = { id: string; file: File; preview: string };

export function resolveProductUnitId(product: { unitId?: number | null; unit?: { id: number } | null }): number {
    const fromScalar = Number(product.unitId);
    if (Number.isFinite(fromScalar) && fromScalar > 0) return fromScalar;
    const fromRelation = Number(product.unit?.id);
    if (Number.isFinite(fromRelation) && fromRelation > 0) return fromRelation;
    return 0;
}

export function getAttributeCharacteristicIds(attr: AttributeListItem | undefined): number[] {
    const links = attr?.characteristics ?? [];
    return [...links]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.characteristic.id - b.characteristic.id)
        .map((l) => l.characteristic.id);
}

function normalizeCharacteristicKey(name: string): string {
    return name.trim().toLowerCase();
}

/** Все характеристики, привязанные к выбранным значениям справочника (включая бренд-родителя). */
export function collectLinkedCharacteristicIds(
    selectedAttrs: Record<number, number | null>,
    allAttributes: AttributeListItem[],
): number[] {
    const ordered: number[] = [];
    const seen = new Set<number>();

    const addFromAttribute = (attr: AttributeListItem | undefined) => {
        if (!attr) return;
        for (const cid of getAttributeCharacteristicIds(attr)) {
            if (!seen.has(cid)) {
                seen.add(cid);
                ordered.push(cid);
            }
        }
    };

    for (const attrId of Object.values(selectedAttrs)) {
        if (attrId == null) continue;
        let current: AttributeListItem | undefined = allAttributes.find((a) => a.id === attrId);
        while (current) {
            addFromAttribute(current);
            const parentId = current.parentId;
            if (parentId == null) break;
            current = allAttributes.find((a) => a.id === parentId);
        }
    }

    return ordered;
}

/**
 * Значения характеристик по выбранным атрибутам: если имя характеристики совпадает с типом
 * справочника (Цвет, Размер, …), подставляется название выбранного значения.
 */
export function buildAutoCharacteristicValues(
    selectedAttrs: Record<number, number | null>,
    allAttributes: AttributeListItem[],
    attributeTypes: { id: number; name: string }[],
    allCharacteristics: { id: number; name: string }[],
): Record<number, string> {
    const typeNameById = new Map(attributeTypes.map((t) => [t.id, t.name.trim()]));
    const charNameById = new Map(allCharacteristics.map((c) => [c.id, c.name.trim()]));
    const values: Record<number, string> = {};

    for (const [typeIdStr, attrId] of Object.entries(selectedAttrs)) {
        if (attrId == null) continue;
        const typeId = Number(typeIdStr);
        const typeName = typeNameById.get(typeId);
        if (!typeName) continue;
        const attr = allAttributes.find((a) => a.id === attrId);
        const attrName = attr?.name?.trim();
        if (!attrName) continue;

        const typeKey = normalizeCharacteristicKey(typeName);
        for (const char of allCharacteristics) {
            if (normalizeCharacteristicKey(char.name) === typeKey) {
                values[char.id] = attrName;
            }
        }
    }

    for (const attrId of Object.values(selectedAttrs)) {
        if (attrId == null) continue;
        const attr = allAttributes.find((a) => a.id === attrId);
        if (!attr?.name?.trim()) continue;
        for (const cid of getAttributeCharacteristicIds(attr)) {
            const charName = charNameById.get(cid);
            const typeName = typeNameById.get(attr.typeId);
            if (charName && typeName && normalizeCharacteristicKey(charName) === normalizeCharacteristicKey(typeName)) {
                values[cid] = attr.name.trim();
            }
        }
    }

    return values;
}

export type ProductCharacteristicsSource = {
    attributeValues?: { attribute: { id: number; typeId?: number; type?: { id: number } } }[];
    brand?: { id: number } | null;
    brandId?: number | null;
    characteristicValues?: {
        characteristicId?: number;
        value: string;
        characteristic: { id?: number; name: string };
    }[];
};

/** Характеристики товара в порядке справочника (как в форме карточки). */
export function resolveProductCharacteristics(
    product: ProductCharacteristicsSource,
    allAttributes: AttributeListItem[],
    attributeTypes: { id: number; name: string }[],
    allCharacteristics: { id: number; name: string }[],
): { name: string; value: string }[] {
    const selectedAttrs: Record<number, number | null> = {};
    for (const v of product.attributeValues ?? []) {
        const typeId = v.attribute.typeId ?? v.attribute.type?.id;
        if (typeId != null) selectedAttrs[typeId] = v.attribute.id;
    }

    const brandId = product.brand?.id ?? product.brandId ?? null;
    if (brandId != null) {
        const brandAttr = allAttributes.find((a) => a.id === brandId);
        if (brandAttr?.typeId != null && selectedAttrs[brandAttr.typeId] == null) {
            selectedAttrs[brandAttr.typeId] = brandId;
        }
    }

    const linkedIds = collectLinkedCharacteristicIds(selectedAttrs, allAttributes);
    const charNameById = new Map(allCharacteristics.map((c) => [c.id, c.name.trim()]));
    const savedById = new Map<number, string>();
    for (const cv of product.characteristicValues ?? []) {
        const id = cv.characteristicId ?? cv.characteristic.id;
        if (id == null) continue;
        savedById.set(id, cv.value?.trim() ?? '');
    }

    const auto = buildAutoCharacteristicValues(selectedAttrs, allAttributes, attributeTypes, allCharacteristics);

    return linkedIds
        .map((id) => {
            const name =
                charNameById.get(id) ??
                product.characteristicValues
                    ?.find((cv) => (cv.characteristicId ?? cv.characteristic.id) === id)
                    ?.characteristic.name?.trim() ??
                '';
            const value = (savedById.get(id) || auto[id] || '').trim();
            return { name, value };
        })
        .filter((c) => c.name && c.value);
}

export function revokePendingFiles(files: PendingFile[]) {
    for (const f of files) URL.revokeObjectURL(f.preview);
}

/** Сохраняет пользовательский порядок и добавляет новые id в конец. */
export function syncCharacteristicOrder(prev: number[], activeIds: number[]): number[] {
    const active = new Set(activeIds);
    const kept = prev.filter((id) => active.has(id));
    const missing = activeIds.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
}

export function moveCharacteristicOrder(order: number[], characteristicId: number, direction: 'up' | 'down'): number[] {
    const index = order.indexOf(characteristicId);
    if (index < 0) return order;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export type AttributeBrandNode = {
    id: number;
    name: string;
    values: { id: number; name: string }[];
};

export type AttributesTreeForType = {
    topValues: { id: number; name: string }[];
    brands: AttributeBrandNode[];
};

export function buildAttributesTreeByType(
    items: AttributeListItem[] | undefined,
): Record<number, AttributesTreeForType> {
    const result: Record<number, AttributesTreeForType> = {};
    if (!items) return result;

    const valuesByBrand = new Map<number, { id: number; name: string }[]>();
    for (const item of items) {
        if (!item.isBrand && item.parentId != null) {
            const list = valuesByBrand.get(item.parentId) ?? [];
            list.push({ id: item.id, name: item.name });
            valuesByBrand.set(item.parentId, list);
        }
    }

    for (const item of items) {
        if (item.isBrand && item.parentId == null) {
            const tree = result[item.typeId] ?? { topValues: [], brands: [] };
            tree.brands.push({
                id: item.id,
                name: item.name,
                values: valuesByBrand.get(item.id) ?? [],
            });
            result[item.typeId] = tree;
        } else if (!item.isBrand && item.parentId == null) {
            const tree = result[item.typeId] ?? { topValues: [], brands: [] };
            tree.topValues.push({ id: item.id, name: item.name });
            result[item.typeId] = tree;
        }
    }

    for (const tree of Object.values(result)) {
        tree.topValues.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        tree.brands.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        for (const brand of tree.brands) {
            brand.values.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        }
    }

    return result;
}

export function findAttributeDisplayName(
    treeByType: Record<number, AttributesTreeForType>,
    typeId: number,
    attributeId: number,
): string | undefined {
    const tree = treeByType[typeId];
    if (!tree) return undefined;
    const top = tree.topValues.find((v) => v.id === attributeId);
    if (top) return top.name;
    for (const brand of tree.brands) {
        if (brand.id === attributeId) return brand.name;
        const child = brand.values.find((v) => v.id === attributeId);
        if (child) return `${brand.name} ${child.name}`;
    }
    return undefined;
}
