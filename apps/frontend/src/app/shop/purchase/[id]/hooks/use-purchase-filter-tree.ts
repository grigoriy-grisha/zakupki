'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildAttributeTree,
    collectExpandableIds,
    productMatchesTreeNode,
} from '@/app/(admin)/products/lib/attribute-tree';
import type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from '@/app/(admin)/products/lib/types';
import { trpc } from '@/lib/client/trpc';
import { type AttributeListItem, buildAttributesTreeByType } from '@/lib/product-form-utils';

type PurchaseItem = {
    id: number;
    product: AttrProduct;
};

export function usePurchaseFilterTree(items: PurchaseItem[] | undefined, externalSelectedId?: string | null) {
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const lastExternalIdRef = useRef<string | null | undefined>(undefined);

    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();

    const catalogByType = useMemo(
        () => buildAttributesTreeByType(allAttributes as AttributeListItem[] | undefined),
        [allAttributes],
    );

    const products = useMemo(() => items?.map((i) => i.product) ?? [], [items]);

    const tree = useMemo(
        () => buildAttributeTree((attributeTypes ?? []) as AttributeTypeRow[], products, catalogByType),
        [attributeTypes, products, catalogByType],
    );

    useEffect(() => {
        if (tree.length === 0) return;
        setExpandedIds(new Set(collectExpandableIds(tree)));
    }, [tree]);

    // One-way sync: a category id coming from the URL selects the matching tree
    // node once the tree is built. User clicks are not overridden — the page
    // mirrors selectedId back into the URL, so the ref guard sees no change.
    useEffect(() => {
        if (lastExternalIdRef.current === externalSelectedId) return;
        if (tree.length === 0) return;
        lastExternalIdRef.current = externalSelectedId;
        if (externalSelectedId == null) {
            setSelectedNode(null);
            return;
        }
        const node = findTreeNode(tree, externalSelectedId);
        if (node) setSelectedNode(node);
    }, [externalSelectedId, tree]);

    const filteredItems = useMemo(() => {
        if (!items) return [];
        if (!selectedNode) return items;
        return items.filter((item) => productMatchesTreeNode(item.product, selectedNode));
    }, [items, selectedNode]);

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
        filteredItems,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount: items?.length ?? 0,
    };
}

function findTreeNode(nodes: TreeNode[], id: string): TreeNode | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        const child = findTreeNode(node.children, id);
        if (child) return child;
    }
    return null;
}
