'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { buildAttributeTree, collectExpandableIds, matchesPath } from '../lib/attribute-tree';
import type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from '../lib/types';

export function useProductTree<T extends AttrProduct>(products: T[] | undefined) {
    const [selectedPath, setSelectedPath] = useState<PathSegment[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();

    const tree = useMemo(
        () => buildAttributeTree((attributeTypes ?? []) as AttributeTypeRow[], products ?? []),
        [attributeTypes, products],
    );

    useEffect(() => {
        if (tree.length === 0) return;
        setExpandedIds(new Set(collectExpandableIds(tree)));
    }, [tree]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        if (selectedPath.length === 0) return products;
        return products.filter((p) => matchesPath(p, selectedPath));
    }, [products, selectedPath]);

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
        filteredProducts,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount: products?.length ?? 0,
    };
}
