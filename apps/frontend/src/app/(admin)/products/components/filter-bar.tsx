'use client';

import { ChevronRight, Filter as FilterIcon, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { FilterTree } from './filter-tree';
import type { TreeNode } from '../lib/types';

interface FilterBarProps {
    tree: TreeNode[];
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    onClear: () => void;
    totalCount: number;
    filteredCount: number;
    ancestorPath: { typeId: number; typeName: string; name: string }[];
    selectedFolderLabel: string | null;
}

/**
 * Горизонтальная панель фильтра для каталога товаров.
 *
 * Дерево открывается в `Popover` под кнопкой «Фильтр». Без модальных слоёв —
 * пользователь остаётся в контексте каталога.
 */
export function FilterBar({
    tree,
    selectedId,
    onSelectNode,
    expandedIds,
    onToggle,
    onClear,
    totalCount,
    filteredCount,
    ancestorPath,
    selectedFolderLabel,
}: FilterBarProps) {
    const hasFilter = selectedId != null;
    const hasTree = tree.length > 0;
    const counterLabel = `${filteredCount} ${filteredCount === 1 ? 'товар' : 'товаров'}`;

    if (!hasTree) {
        return (
            <div className="flex items-center justify-between gap-3 py-1">
                <span className="text-14-regular text-fg-secondary tabular-nums">{counterLabel}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2 py-1">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={hasFilter ? 'default' : 'outline'}
                        size="sm"
                        className={cn('rounded-full', hasFilter && 'border-primary/40 bg-primary/10 text-primary')}
                        aria-label="Открыть фильтр товаров"
                    >
                        <FilterIcon className="size-3.5" />
                        Фильтр
                        {hasFilter && <span className="ml-1 text-12-medium">· 1</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-bg-card p-0 shadow-xl ring-1 ring-black/5"
                >
                    <div className="flex items-center justify-between border-b border-border-soft bg-bg-card px-3 py-2">
                        <span className="text-12-medium text-fg-secondary">
                            {filteredCount} из {totalCount}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 rounded-full px-2 text-12-medium"
                            onClick={onClear}
                            disabled={!hasFilter}
                        >
                            Сбросить
                        </Button>
                    </div>
                    <div className="max-h-[60dvh] overflow-y-auto bg-bg-card p-1.5">
                        <FilterTree
                            nodes={tree}
                            selectedId={selectedId}
                            onSelect={onSelectNode}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            totalCount={totalCount}
                            onClear={onClear}
                        />
                    </div>
                </PopoverContent>
            </Popover>

            {hasFilter && (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-14-regular">
                    {ancestorPath.map((segment, i) => (
                        <span
                            key={`${segment.typeId}:${segment.name}`}
                            className="flex items-center gap-1.5 text-fg-tertiary"
                        >
                            {i > 0 && <ChevronRight className="h-3 w-3" />}
                            <span className="text-12-medium">
                                {segment.typeName}: {segment.name}
                            </span>
                        </span>
                    ))}
                    {selectedFolderLabel != null && (
                        <span className="flex items-center gap-1.5 text-fg-secondary">
                            {ancestorPath.length > 0 && <ChevronRight className="h-3 w-3" />}
                            <span className="text-12-medium">{selectedFolderLabel}</span>
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 rounded-full px-2 text-12-medium text-fg-secondary hover:text-fg-primary"
                        onClick={onClear}
                        aria-label="Сбросить фильтр"
                    >
                        <X className="size-3" />
                        Сбросить
                    </Button>
                </div>
            )}

            <span className="ml-auto text-14-regular text-fg-secondary tabular-nums">{counterLabel}</span>
        </div>
    );
}
