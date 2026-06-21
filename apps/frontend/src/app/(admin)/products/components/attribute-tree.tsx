'use client';

import { ChevronDown, ChevronRight, FolderOpen, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function AttributeTree({ nodes, selectedId, onSelect, expandedIds, onToggle, depth = 0 }: AttributeTreeProps) {
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
                                'h-auto w-full justify-start gap-1.5 rounded-md px-2 py-1.5 text-14-regular',
                                isSelected && 'bg-bg-soft text-14-medium',
                                node.isTypeFolder && 'text-fg-tertiary',
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
                                        <ChevronDown className="size-3.5" />
                                    ) : (
                                        <ChevronRight className="size-3.5" />
                                    )}
                                </span>
                            ) : (
                                <span className="w-3.5" />
                            )}
                            {node.isBrandFolder ? (
                                <Tag className="size-3.5 shrink-0 text-fg-tertiary" />
                            ) : (
                                <FolderOpen
                                    className={cn(
                                        'size-4 shrink-0',
                                        node.isTypeFolder ? 'text-fg-tertiary/70' : 'text-fg-tertiary',
                                    )}
                                />
                            )}
                            <span className={cn('truncate', node.isTypeFolder && 'text-14-medium')}>{node.label}</span>
                            <span className="ml-auto pl-2 text-12-regular text-fg-tertiary">{node.count}</span>
                        </Button>
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
