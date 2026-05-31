'use client';

import { ChevronDown, ChevronRight, FolderOpen, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '../lib/types';

export interface AttributeTreeProps {
    nodes: TreeNode[];
    selectedId: string | null;
    onSelect: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    depth?: number;
}

export function AttributeTree({
    nodes,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    depth = 0,
}: AttributeTreeProps) {
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
                                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                                isSelected && 'bg-accent font-medium',
                                node.isTypeFolder && 'text-muted-foreground',
                            )}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
                            <span className={cn('truncate', node.isTypeFolder && 'font-medium')}>{node.label}</span>
                            <span className="ml-auto pl-2 text-xs text-muted-foreground">{node.count}</span>
                        </button>
                        {hasChildren && isExpanded && (
                            <AttributeTree
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
