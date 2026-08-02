import type { ProductAttributeValueSource, AttributeTypeMeta, ShowInTitleByTypeId } from './types';

export function attributeTypeId(v: ProductAttributeValueSource): number | undefined {
    return v.attribute.typeId ?? v.attribute.type.id;
}

type TypeMaps = {
    byId: Map<number, AttributeTypeMeta>;
    childrenOf: Map<number | null, AttributeTypeMeta[]>;
};

export function buildTypeMaps(types: AttributeTypeMeta[]): TypeMaps {
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

export function sortAttributeValuesByTypeTree(
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

export function typeHasShowInTitle(typeId: number, maps: TypeMaps, showInTitleByTypeId?: ShowInTitleByTypeId): boolean {
    if (showInTitleByTypeId && typeId in showInTitleByTypeId) {
        return showInTitleByTypeId[typeId];
    }
    const meta = maps.byId.get(typeId);
    if (meta && meta.showInTitle !== undefined) {
        return meta.showInTitle;
    }
    return true;
}

export function typeOrAncestorShowsInTitle(
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

export function hasDescendantWithShowInTitle(
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

export function isShowInTitle(
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

export function buildShowInTitleByTypeId(
    types: Pick<AttributeTypeMeta, 'id' | 'showInTitle'>[] | undefined,
): ShowInTitleByTypeId | undefined {
    if (!types?.length) return undefined;
    return Object.fromEntries(types.map((t) => [t.id, t.showInTitle !== false]));
}
