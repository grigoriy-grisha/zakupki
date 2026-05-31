import type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from './types';

function productValueForType(product: AttrProduct, typeId: number): string | null {
    const found = (product.attributeValues ?? []).find((v) => v.attribute.typeId === typeId);
    return found?.attribute.name?.trim() || null;
}

function groupProductsByTypeValue(
    type: AttributeTypeRow,
    subset: AttrProduct[],
): Map<string, AttrProduct[]> {
    const groups = new Map<string, AttrProduct[]>();
    for (const product of subset) {
        const value = productValueForType(product, type.id);
        if (!value) continue;
        const list = groups.get(value) ?? [];
        list.push(product);
        groups.set(value, list);
    }
    return groups;
}

function valueNodesForType(
    type: AttributeTypeRow,
    groups: Map<string, AttrProduct[]>,
    childTypes: AttributeTypeRow[],
    ancestors: PathSegment[],
    build: (siblingTypes: AttributeTypeRow[], subset: AttrProduct[], ancestors: PathSegment[]) => TreeNode[],
): TreeNode[] {
    const nodes: TreeNode[] = [];
    const sortedNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
    for (const name of sortedNames) {
        const groupProducts = groups.get(name)!;
        const path: PathSegment[] = [...ancestors, { typeId: type.id, typeName: type.name, name }];
        nodes.push({
            id: path.map((p) => `${p.typeId}:${p.name}`).join('/'),
            label: name,
            isTypeFolder: false,
            typeId: type.id,
            count: groupProducts.length,
            path,
            children: build(childTypes, groupProducts, path),
        });
    }
    return nodes;
}

function countNodes(nodes: TreeNode[]): number {
    return nodes.reduce((sum, n) => sum + n.count, 0);
}

/** Дерево: папка типа → значения → папка подтипа → … */
export function buildAttributeTree(types: AttributeTypeRow[], products: AttrProduct[]): TreeNode[] {
    const childrenOf = (parentId: number | null) =>
        types
            .filter((t) => (t.parentId ?? null) === parentId)
            .sort((a, b) => a.position - b.position || a.id - b.id);

    function build(siblingTypes: AttributeTypeRow[], subset: AttrProduct[], ancestors: PathSegment[]): TreeNode[] {
        const nodes: TreeNode[] = [];

        for (const type of siblingTypes) {
            const childTypes = childrenOf(type.id);
            const groups = groupProductsByTypeValue(type, subset);

            if (!type.showInTree) {
                nodes.push(...valueNodesForType(type, groups, childTypes, ancestors, build));
                const withoutValueHere = subset.filter((p) => !productValueForType(p, type.id));
                if (childTypes.length > 0 && withoutValueHere.length > 0) {
                    nodes.push(...build(childTypes, withoutValueHere, ancestors));
                }
                continue;
            }

            if (groups.size === 0) {
                if (childTypes.length > 0) {
                    const childNodes = build(childTypes, subset, ancestors);
                    if (childNodes.length > 0) {
                        nodes.push({
                            id: `type:${type.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`,
                            label: type.name,
                            isTypeFolder: true,
                            typeId: type.id,
                            count: countNodes(childNodes),
                            path: ancestors,
                            children: childNodes,
                        });
                    }
                }
                continue;
            }

            const folderId = `type:${type.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`;
            const folderNode: TreeNode = {
                id: folderId,
                label: type.name,
                isTypeFolder: true,
                typeId: type.id,
                count: [...groups.values()].reduce((sum, list) => sum + list.length, 0),
                path: ancestors,
                children: valueNodesForType(type, groups, childTypes, ancestors, build),
            };
            folderNode.count = countNodes(folderNode.children);

            nodes.push(folderNode);
        }

        return nodes;
    }

    return build(childrenOf(null), products, []);
}

export function collectExpandableIds(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) => [
        ...(n.children.length > 0 ? [n.id] : []),
        ...collectExpandableIds(n.children),
    ]);
}

export function matchesPath(product: AttrProduct, path: PathSegment[]): boolean {
    const values = product.attributeValues ?? [];
    return path.every((segment) =>
        values.some((v) => v.attribute.typeId === segment.typeId && v.attribute.name?.trim() === segment.name),
    );
}
