'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import type { TreeNode } from '@/app/(admin)/products/lib/types';
import { FilterTree } from '@/components/shared/filter-tree';
import { cn } from '@/lib/utils';

interface CatalogFilterBlockProps {
    tree: TreeNode[];
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    onClearTree: () => void;
    totalCount: number;
    filteredCount: number;
    className?: string;
}

export function CatalogFilterBlock({
    tree,
    selectedId,
    onSelectNode,
    expandedIds,
    onToggle,
    onClearTree,
    totalCount,
    filteredCount,
    className,
}: CatalogFilterBlockProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={cn('w-full min-w-0', className)}>
            <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                aria-expanded={!collapsed}
                className="flex w-full items-center justify-between gap-2"
            >
                <span className="flex items-center gap-2 text-14-medium text-fg-primary">
                    <SlidersHorizontal className="size-4" />
                    Фильтр
                </span>
                <span className="flex items-center gap-2">
                    {selectedId != null && (
                        <span className="text-12-regular text-fg-tertiary tabular-nums">
                            {filteredCount} из {totalCount}
                        </span>
                    )}
                    <ChevronDown
                        className={cn('size-4 text-fg-tertiary transition-transform', !collapsed && 'rotate-180')}
                    />
                </span>
            </button>

            <div
                className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                    collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                )}
            >
                <div className="overflow-hidden">
                    <div className="mt-4">
                        <FilterTree
                            compact
                            nodes={tree}
                            selectedId={selectedId}
                            onSelect={onSelectNode}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            totalCount={totalCount}
                            onClear={onClearTree}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
