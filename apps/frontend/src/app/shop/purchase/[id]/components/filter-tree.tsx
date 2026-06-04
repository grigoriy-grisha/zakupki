'use client';

import { ChevronDown, ChevronRight, FolderOpen, Tag, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '@/app/(admin)/products/lib/types';

export interface FilterTreeProps {
    nodes: TreeNode[];
    selectedId: string | null;
    onSelect: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    totalCount: number;
    onClear: () => void;
    depth?: number;
}

export function FilterTree({
    nodes,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    totalCount,
    onClear,
}: FilterTreeProps) {
    return (
        <div className="space-y-0.5">
            <button
                onClick={onClear}
                className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors',
                    selectedId === null && 'bg-accent font-medium',
                )}
            >
                <Package className="h-4 w-4 text-muted-foreground" />
                Все товары
                <span className="ml-auto text-xs text-muted-foreground">{totalCount}</span>
            </button>

            <FilterTreeNode
                nodes={nodes}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
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
}: Omit<FilterTreeProps, 'totalCount' | 'onClear'> & { depth?: number }) {
    return (
        <div className="space-y-0.5">
            {nodes.map((node) => {
                const hasChildren = node.children.length > 0;
                const isExpanded = expandedIds.has(node.id);
                const isSelected = !node.isTypeFolder && selectedId === node.id;
                return (
                    <div key={node.id}>
                        <button
                            type="button"
                            onClick={() => {
                                if (node.isTypeFolder) {
                                    if (hasChildren) onToggle(node.id);
                                } else {
                                    onSelect(node);
                                }
                            }}
                            className={cn(
                                'flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                                isSelected && 'bg-accent font-medium',
                                node.isTypeFolder && 'text-muted-foreground',
                            )}
                            style={{ paddingLeft: `${depth * 16 + 12}px` }}
                        >
                            {hasChildren ? (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle(node.id);
                                    }}
                                    className="cursor-pointer"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </span>
                            ) : (
                                <span className="w-3.5" />
                            )}
                            {node.isBrandFolder ? (
                                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                                <FolderOpen
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        node.isTypeFolder ? 'text-muted-foreground/70' : 'text-muted-foreground',
                                    )}
                                />
                            )}
                            <span className={cn('text-left break-words', node.isTypeFolder && 'font-medium')}>{node.label}</span>
                            <span className="ml-auto pl-2 text-xs text-muted-foreground">{node.count}</span>
                        </button>
                        {hasChildren && isExpanded && (
                            <FilterTreeNode
                                nodes={node.children}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                expandedIds={expandedIds}
                                onToggle={onToggle}
                                depth={depth + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
