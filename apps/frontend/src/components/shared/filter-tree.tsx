'use client';

import { ChevronDown, ChevronRight, FolderOpen, Package, Tag } from 'lucide-react';

import type { TreeNode } from '@/app/(admin)/products/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterTreeProps {
    nodes: TreeNode[];
    selectedId: string | null;
    onSelect: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    totalCount: number;
    onClear: () => void;
    /** Truncate long labels instead of wrapping — for narrow columns. */
    compact?: boolean;
}

export function FilterTree({
    nodes,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    totalCount,
    onClear,
    compact = false,
}: FilterTreeProps) {
    return (
        <div className="space-y-0.5">
            <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className={cn(
                    'h-auto w-full justify-start gap-2 rounded-full px-3 py-2 text-13-medium',
                    selectedId === null ? 'bg-bg-soft text-fg-primary hover:bg-bg-soft' : 'text-fg-secondary',
                )}
            >
                <Package className="size-4" />
                <span className={cn('min-w-0 flex-1 text-left', compact ? 'truncate' : undefined)}>Все товары</span>
                <span className="ml-auto shrink-0 rounded-full bg-bg-soft px-2 text-12-medium tabular-nums text-fg-tertiary">
                    {totalCount}
                </span>
            </Button>

            <FilterTreeNode
                nodes={nodes}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
                compact={compact}
            />
        </div>
    );
}

function FilterTreeNode({
    nodes,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    depth = 0,
    compact,
}: Omit<FilterTreeProps, 'totalCount' | 'onClear'> & { depth?: number }) {
    return (
        <div className="space-y-0.5">
            {nodes.map((node) => {
                const hasChildren = node.children.length > 0;
                const isExpanded = expandedIds.has(node.id);
                const isSelected = selectedId === node.id;
                return (
                    <div key={node.id}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelect(node)}
                            className={cn(
                                'h-auto w-full justify-start gap-1.5 rounded-full px-3 py-1.5 text-13-medium',
                                isSelected ? 'bg-bg-soft text-fg-primary hover:bg-bg-soft' : 'text-fg-secondary',
                                node.isTypeFolder && !isSelected && 'text-fg-tertiary',
                            )}
                            style={{ paddingLeft: `${depth * 14 + 12}px` }}
                        >
                            {hasChildren ? (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle(node.id);
                                    }}
                                    className="flex h-5 w-5 shrink-0 items-center justify-center"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="size-3.5" />
                                    ) : (
                                        <ChevronRight className="size-3.5" />
                                    )}
                                </span>
                            ) : (
                                <span className="w-5 shrink-0" />
                            )}
                            {node.isBrandFolder ? (
                                <Tag className="size-3.5 shrink-0 text-fg-tertiary" />
                            ) : (
                                <FolderOpen
                                    className={cn(
                                        'size-4 shrink-0 text-fg-tertiary',
                                        node.isTypeFolder && 'opacity-70',
                                    )}
                                />
                            )}
                            <span
                                className={cn(
                                    'min-w-0 flex-1 text-left',
                                    compact ? 'truncate' : 'break-words',
                                )}
                            >
                                {node.label}
                            </span>
                            <span
                                className={cn(
                                    'rounded-full bg-bg-soft px-2 text-12-medium tabular-nums text-fg-tertiary',
                                    compact ? 'shrink-0' : 'ml-auto',
                                )}
                            >
                                {node.count}
                            </span>
                        </Button>
                        {hasChildren && isExpanded && (
                            <FilterTreeNode
                                nodes={node.children}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                expandedIds={expandedIds}
                                onToggle={onToggle}
                                depth={depth + 1}
                                compact={compact}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
