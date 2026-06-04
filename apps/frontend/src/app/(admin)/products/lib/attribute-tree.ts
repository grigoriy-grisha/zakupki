import type { AttributesTreeForType } from './product-form-utils';
import type { AttributeTypeRow, AttrProduct, PathSegment, ProductAttributeRef, TreeNode } from './types';

function getProductAttributeAtType(product: AttrProduct, typeId: number): ProductAttributeRef | null {
    const fromValues = product.attributeValues?.find((v) => v.attribute.typeId === typeId);
    if (fromValues) return fromValues.attribute;

    const brand = product.brand;
    if (brand?.name?.trim() && (brand.typeId === typeId || brand.typeId == null)) {
        return {
            id: brand.id,
            name: brand.name,
            typeId,
            isBrand: true,
            parentId: null,
        };
    }

    return null;
}

type ValueGroup = { attributeId: number; name: string; products: AttrProduct[] };
type BrandGroup = {
    attributeId: number;
    name: string;
    brandProducts: AttrProduct[];
    childValues: Map<number, ValueGroup>;
};

type TypeProductGroups = {
    topValues: Map<number, ValueGroup>;
    brands: Map<number, BrandGroup>;
};

function groupProductsForType(
    typeId: number,
    products: AttrProduct[],
    brandNames: Map<number, string>,
): TypeProductGroups {
    const groups: TypeProductGroups = {
        topValues: new Map(),
        brands: new Map(),
    };

    for (const product of products) {
        const attr = getProductAttributeAtType(product, typeId);
        if (!attr?.name?.trim()) continue;

        if (attr.isBrand) {
            const brand =
                groups.brands.get(attr.id) ??
                ({
                    attributeId: attr.id,
                    name: attr.name.trim(),
                    brandProducts: [],
                    childValues: new Map(),
                } satisfies BrandGroup);
            brand.brandProducts.push(product);
            groups.brands.set(attr.id, brand);
            continue;
        }

        const parentId = attr.parentId ?? attr.parent?.id ?? null;
        if (parentId != null) {
            const brandName = attr.parent?.name?.trim() ?? brandNames.get(parentId) ?? 'Бренд';
            const brand =
                groups.brands.get(parentId) ??
                ({
                    attributeId: parentId,
                    name: brandName,
                    brandProducts: [],
                    childValues: new Map(),
                } satisfies BrandGroup);
            const child =
                brand.childValues.get(attr.id) ??
                ({
                    attributeId: attr.id,
                    name: attr.name.trim(),
                    products: [],
                } satisfies ValueGroup);
            child.products.push(product);
            brand.childValues.set(attr.id, child);
            groups.brands.set(parentId, brand);
            continue;
        }

        const top =
            groups.topValues.get(attr.id) ??
            ({
                attributeId: attr.id,
                name: attr.name.trim(),
                products: [],
            } satisfies ValueGroup);
        top.products.push(product);
        groups.topValues.set(attr.id, top);
    }

    return groups;
}

function buildBrandNameIndex(catalogByType: Record<number, AttributesTreeForType>): Map<number, string> {
    const names = new Map<number, string>();
    for (const tree of Object.values(catalogByType)) {
        for (const brand of tree.brands) {
            names.set(brand.id, brand.name);
        }
    }
    return names;
}

function valueNode(
    type: AttributeTypeRow,
    group: ValueGroup,
    ancestors: PathSegment[],
    childTypes: AttributeTypeRow[],
    build: BuildFn,
    extraPath?: Partial<PathSegment>,
): TreeNode {
    const path: PathSegment[] = [
        ...ancestors,
        {
            typeId: type.id,
            typeName: type.name,
            name: group.name,
            attributeId: group.attributeId,
            ...extraPath,
        },
    ];
    return {
        id: path.map((p) => `${p.typeId}:${p.brandAttributeId ?? ''}:${p.name}`).join('/'),
        label: group.name,
        isTypeFolder: false,
        typeId: type.id,
        count: group.products.length,
        path,
        children: build(childTypes, group.products, path),
    };
}

type BuildFn = (
    siblingTypes: AttributeTypeRow[],
    subset: AttrProduct[],
    ancestors: PathSegment[],
) => TreeNode[];

function buildTypeValueNodes(
    type: AttributeTypeRow,
    subset: AttrProduct[],
    ancestors: PathSegment[],
    childTypes: AttributeTypeRow[],
    build: BuildFn,
    catalogByType: Record<number, AttributesTreeForType>,
    brandNames: Map<number, string>,
): TreeNode[] {
    const groups = groupProductsForType(type.id, subset, brandNames);
    const catalog = catalogByType[type.id];
    const nodes: TreeNode[] = [];

    const topValueIds = new Set<number>();
    if (catalog) {
        for (const value of catalog.topValues) {
            topValueIds.add(value.id);
            const group = groups.topValues.get(value.id);
            if (group) nodes.push(valueNode(type, group, ancestors, childTypes, build));
        }
    }
    for (const group of groups.topValues.values()) {
        if (!topValueIds.has(group.attributeId)) {
            nodes.push(valueNode(type, group, ancestors, childTypes, build));
        }
    }

    const brandIds = new Set<number>();
    const catalogBrands = catalog?.brands ?? [];
    for (const brandMeta of catalogBrands) {
        brandIds.add(brandMeta.id);
        const brandGroup = groups.brands.get(brandMeta.id);
        if (!brandGroup) continue;

        const brandPath: PathSegment[] = [
            ...ancestors,
            {
                typeId: type.id,
                typeName: type.name,
                name: brandGroup.name,
                attributeId: brandGroup.attributeId,
                isBrand: true,
            },
        ];

        const brandChildren: TreeNode[] = [];

        if (brandGroup.brandProducts.length > 0) {
            brandChildren.push({
                id: brandPath.map((p) => `${p.typeId}:${p.brandAttributeId ?? ''}:${p.name}`).join('/'),
                label: brandGroup.name,
                isTypeFolder: false,
                typeId: type.id,
                count: brandGroup.brandProducts.length,
                path: brandPath,
                children: build(childTypes, brandGroup.brandProducts, brandPath),
            });
        }

        for (const valueMeta of brandMeta.values) {
            const childGroup = brandGroup.childValues.get(valueMeta.id);
            if (!childGroup) continue;
            brandChildren.push(
                valueNode(type, childGroup, ancestors, childTypes, build, {
                    brandAttributeId: brandGroup.attributeId,
                }),
            );
        }

        for (const childGroup of brandGroup.childValues.values()) {
            if (brandMeta.values.some((v) => v.id === childGroup.attributeId)) continue;
            brandChildren.push(
                valueNode(type, childGroup, ancestors, childTypes, build, {
                    brandAttributeId: brandGroup.attributeId,
                }),
            );
        }

        if (brandChildren.length === 0) continue;

        const folderId = `brand:${type.id}:${brandMeta.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`;
        nodes.push({
            id: folderId,
            label: brandGroup.name,
            isTypeFolder: true,
            isBrandFolder: true,
            typeId: type.id,
            count: countNodes(brandChildren),
            path: ancestors,
            children: brandChildren,
        });
    }

    for (const brandGroup of groups.brands.values()) {
        if (brandIds.has(brandGroup.attributeId)) continue;

        const brandPath: PathSegment[] = [
            ...ancestors,
            {
                typeId: type.id,
                typeName: type.name,
                name: brandGroup.name,
                attributeId: brandGroup.attributeId,
                isBrand: true,
            },
        ];
        const brandChildren: TreeNode[] = [];

        if (brandGroup.brandProducts.length > 0) {
            brandChildren.push({
                id: brandPath.map((p) => `${p.typeId}:${p.brandAttributeId ?? ''}:${p.name}`).join('/'),
                label: brandGroup.name,
                isTypeFolder: false,
                typeId: type.id,
                count: brandGroup.brandProducts.length,
                path: brandPath,
                children: build(childTypes, brandGroup.brandProducts, brandPath),
            });
        }

        for (const childGroup of brandGroup.childValues.values()) {
            brandChildren.push(
                valueNode(type, childGroup, ancestors, childTypes, build, {
                    brandAttributeId: brandGroup.attributeId,
                }),
            );
        }

        if (brandChildren.length === 0) continue;

        nodes.push({
            id: `brand:${type.id}:${brandGroup.attributeId}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`,
            label: brandGroup.name,
            isTypeFolder: true,
            isBrandFolder: true,
            typeId: type.id,
            count: countNodes(brandChildren),
            path: ancestors,
            children: brandChildren,
        });
    }

    return nodes;
}

function countNodes(nodes: TreeNode[]): number {
    return nodes.reduce((sum, n) => sum + n.count, 0);
}

/** Дерево каталога: тип → бренд → значение (как в справочнике). */
export function buildAttributeTree(
    types: AttributeTypeRow[],
    products: AttrProduct[],
    catalogByType: Record<number, AttributesTreeForType> = {},
): TreeNode[] {
    const brandNames = buildBrandNameIndex(catalogByType);
    const childrenOf = (parentId: number | null) =>
        types
            .filter((t) => (t.parentId ?? null) === parentId)
            .sort((a, b) => a.position - b.position || a.id - b.id);

    const build: BuildFn = (siblingTypes, subset, ancestors) => {
        const nodes: TreeNode[] = [];

        for (const type of siblingTypes) {
            const childTypes = childrenOf(type.id);
            const valueNodes = buildTypeValueNodes(
                type,
                subset,
                ancestors,
                childTypes,
                build,
                catalogByType,
                brandNames,
            );

            if (valueNodes.length === 0) {
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

            const folderNode: TreeNode = {
                id: `type:${type.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`,
                label: type.name,
                isTypeFolder: true,
                typeId: type.id,
                count: countNodes(valueNodes),
                path: ancestors,
                children: valueNodes,
            };
            nodes.push(folderNode);
        }

        return nodes;
    };

    return build(childrenOf(null), products, []);
}

export function collectExpandableIds(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) => [
        ...(n.children.length > 0 ? [n.id] : []),
        ...collectExpandableIds(n.children),
    ]);
}

function matchesSegment(product: AttrProduct, segment: PathSegment): boolean {
    const attr = getProductAttributeAtType(product, segment.typeId);
    if (!attr?.name?.trim()) return false;
    if (attr.name.trim() !== segment.name.trim()) return false;

    if (segment.brandAttributeId != null) {
        const parentId = attr.parentId ?? attr.parent?.id ?? null;
        return parentId === segment.brandAttributeId;
    }

    if (segment.isBrand) {
        return Boolean(attr.isBrand);
    }

    return !attr.isBrand && (attr.parentId == null && attr.parent?.id == null);
}

export function matchesPath(product: AttrProduct, path: PathSegment[]): boolean {
    return path.every((segment) => matchesSegment(product, segment));
}

/** Все конечные пути фильтра внутри узла (значения под типом/брендом). */
function collectLeafFilterPaths(node: TreeNode): PathSegment[][] {
    if (!node.isTypeFolder) {
        return [node.path];
    }
    return node.children.flatMap((child) => collectLeafFilterPaths(child));
}

/** Товар подходит под выбранный узел дерева (значение, тип или бренд). */
export function productMatchesTreeNode(product: AttrProduct, node: TreeNode): boolean {
    const paths = collectLeafFilterPaths(node);
    if (paths.length === 0) return false;
    return paths.some((path) => matchesPath(product, path));
}
