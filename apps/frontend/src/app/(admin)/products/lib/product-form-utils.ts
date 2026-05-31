export type AttributeListItem = {
    id: number;
    typeId: number;
    name: string;
    isBrand?: boolean;
    parentId?: number | null;
    characteristics?: { characteristic: { id: number } }[];
};

export type PendingFile = { id: string; file: File; preview: string };

export function getAttributeCharacteristicIds(attr: AttributeListItem | undefined): number[] {
    return attr?.characteristics?.map((l) => l.characteristic.id) ?? [];
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

export function moveCharacteristicOrder(
    order: number[],
    characteristicId: number,
    direction: 'up' | 'down',
): number[] {
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
        if (child) return `${brand.name} / ${child.name}`;
    }
    return undefined;
}

/** @deprecated Используйте buildAttributesTreeByType */
export function groupAttributesByType(
    items: AttributeListItem[] | undefined,
): Record<number, { id: number; name: string }[]> {
    const tree = buildAttributesTreeByType(items);
    const result: Record<number, { id: number; name: string }[]> = {};
    for (const [typeId, node] of Object.entries(tree)) {
        result[Number(typeId)] = [
            ...node.topValues,
            ...node.brands.flatMap((b) => [
                { id: b.id, name: b.name },
                ...b.values.map((v) => ({ id: v.id, name: `${b.name} / ${v.name}` })),
            ]),
        ];
    }
    return result;
}
