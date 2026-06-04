'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import {
    buildAttributeTree,
    collectExpandableIds,
    matchesPath,
} from '@/app/(admin)/products/lib/attribute-tree';
import { buildAttributesTreeByType, type AttributeListItem } from '@/app/(admin)/products/lib/product-form-utils';
import type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from '@/app/(admin)/products/lib/types';

type PurchaseItem = {
    id: number;
    product: AttrProduct;
};

export function usePurchaseFilterTree(items: PurchaseItem[] | undefined) {
    const [selectedPath, setSelectedPath] = useState<PathSegment[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();

    const catalogByType = useMemo(
        () => buildAttributesTreeByType(allAttributes as AttributeListItem[] | undefined),
        [allAttributes],
    );

    const products = useMemo(() => items?.map((i) => i.product) ?? [], [items]);

    const tree = useMemo(
        () =>
            buildAttributeTree(
                (attributeTypes ?? []) as AttributeTypeRow[],
                products,
                catalogByType,
            ),
        [attributeTypes, products, catalogByType],
    );

    useEffect(() => {
        if (tree.length === 0) return;
        setExpandedIds(new Set(collectExpandableIds(tree)));
    }, [tree]);

    const filteredItems = useMemo(() => {
        if (!items) return [];
        if (selectedPath.length === 0) return items;
        return items.filter((item) => matchesPath(item.product, selectedPath));
    }, [items, selectedPath]);

    function handleToggle(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleSelectNode(node: TreeNode) {
        if (node.isTypeFolder) return;
        setSelectedId(node.id);
        setSelectedPath(node.path);
        if (node.children.length > 0) {
            setExpandedIds((prev) => new Set(prev).add(node.id));
        }
    }

    function clearSelection() {
        setSelectedId(null);
        setSelectedPath([]);
    }

    return {
        tree,
        selectedPath,
        selectedId,
        expandedIds,
        filteredItems,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount: items?.length ?? 0,
    };
}
