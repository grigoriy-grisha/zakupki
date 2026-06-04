'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { buildAttributeTree, collectExpandableIds, productMatchesTreeNode } from '../lib/attribute-tree';
import { buildAttributesTreeByType, type AttributeListItem } from '../lib/product-form-utils';
import type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from '../lib/types';

export function useProductTree<T extends AttrProduct>(products: T[] | undefined) {
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();

    const catalogByType = useMemo(
        () => buildAttributesTreeByType(allAttributes as AttributeListItem[] | undefined),
        [allAttributes],
    );

    const tree = useMemo(
        () => buildAttributeTree((attributeTypes ?? []) as AttributeTypeRow[], products ?? [], catalogByType),
        [attributeTypes, products, catalogByType],
    );

    useEffect(() => {
        if (tree.length === 0) return;
        setExpandedIds(new Set(collectExpandableIds(tree)));
    }, [tree]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        if (!selectedNode) return products;
        return products.filter((p) => productMatchesTreeNode(p, selectedNode));
    }, [products, selectedNode]);

    const selectedId = selectedNode?.id ?? null;
    const selectedPath: PathSegment[] = selectedNode && !selectedNode.isTypeFolder ? selectedNode.path : [];
    const selectedFolderLabel = selectedNode?.isTypeFolder ? selectedNode.label : null;
    const ancestorPath: PathSegment[] = selectedNode?.isTypeFolder ? selectedNode.path : [];

    function handleToggle(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleSelectNode(node: TreeNode) {
        setSelectedNode(node);
        if (node.children.length > 0) {
            setExpandedIds((prev) => new Set(prev).add(node.id));
        }
    }

    function clearSelection() {
        setSelectedNode(null);
    }

    return {
        tree,
        selectedPath,
        selectedId,
        selectedFolderLabel,
        ancestorPath,
        expandedIds,
        filteredProducts,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount: products?.length ?? 0,
    };
}
