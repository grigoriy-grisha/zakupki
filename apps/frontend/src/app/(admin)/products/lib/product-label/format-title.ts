import {
    buildTypeMaps,
    typeHasShowInTitle,
    typeOrAncestorShowsInTitle,
    hasDescendantWithShowInTitle,
    isShowInTitle,
    buildShowInTitleByTypeId,
} from './type-tree';
import {
    attributeTypeId,
    orderedValues,
    formatAttributeValueName,
    buildValuesByTypeId,
    attributeValueShowsInTitle,
} from './format-attributes';
import type { ProductAttributeValueSource, AttributeTypeMeta, ShowInTitleByTypeId, ProductLabelSource } from './types';

/** Значения атрибутов с флагом «показывать в заголовке описания» по порядку дерева типов. */
export function getProductTitleAttributeNames(
    product: ProductLabelSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): string[] {
    if (!attributeTypes?.length) {
        return orderedValues(product, attributeTypes)
            .filter(
                (v) => isShowInTitle(v, showInTitleByTypeId, attributeTypes) && attributeValueShowsInTitle(v.attribute),
            )
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

/** Тип или его предок/потомок участвует в первой строке заголовка. */
function isTypeInTitleBranch(typeId: number, maps: ReturnType<typeof buildTypeMaps>, showInTitleByTypeId?: ShowInTitleByTypeId): boolean {
    return (
        typeHasShowInTitle(typeId, maps, showInTitleByTypeId) ||
        typeOrAncestorShowsInTitle(typeId, maps, showInTitleByTypeId) ||
        hasDescendantWithShowInTitle(typeId, maps, showInTitleByTypeId)
    );
}

function hasSelectedValueInDescendant(
    typeId: number,
    valuesByTypeId: Map<number, ProductAttributeValueSource>,
    maps: ReturnType<typeof buildTypeMaps>,
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
    maps: ReturnType<typeof buildTypeMaps>,
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
    maps: ReturnType<typeof buildTypeMaps>,
    valuesByTypeId: Map<number, ProductAttributeValueSource>,
    showInTitleByTypeId?: ShowInTitleByTypeId,
): boolean {
    if (!typeHasShowInTitle(typeId, maps, showInTitleByTypeId)) return false;
    if (valuesByTypeId.has(typeId)) return false;
    if (!hasSelectedValueInDescendant(typeId, valuesByTypeId, maps)) return false;
    if (hasAncestorWithSelectedValue(typeId, valuesByTypeId, maps)) return false;
    return true;
}
