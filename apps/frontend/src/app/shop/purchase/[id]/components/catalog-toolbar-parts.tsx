'use client';

import { Filter as FilterIcon } from 'lucide-react';
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';

import type { TreeNode } from '@/app/(admin)/products/lib/types';
import { FilterTree } from '@/components/shared/filter-tree';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'default', label: 'По умолчанию' },
    { value: 'price-asc', label: 'Сначала дешевле' },
    { value: 'price-desc', label: 'Сначала дороже' },
    { value: 'name-asc', label: 'По названию' },
];

export function CatalogFilterPopover({
    tree,
    selectedId,
    onSelectNode,
    expandedIds,
    onToggle,
    onClearTree,
    totalCount,
    filteredCount,
}: {
    tree: TreeNode[];
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    onClearTree: () => void;
    totalCount: number;
    filteredCount: number;
}) {
    const hasTreeFilter = selectedId != null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        'h-9 shrink-0 rounded-xl px-0 md:rounded-full md:px-4',
                        hasTreeFilter && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                    aria-label="Фильтр товаров"
                >
                    <FilterIcon className="size-4" />
                    <span className="hidden md:inline">Фильтр</span>
                    {hasTreeFilter && <span className="hidden size-1.5 rounded-full bg-primary md:inline" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={8}
                className={cn(
                    'w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl',
                    'border border-border bg-bg-card p-0 shadow-xl ring-1 ring-black/5',
                )}
            >
                <div
                    className={cn(
                        'flex items-center justify-between border-b border-border-soft',
                        'bg-bg-card px-3 py-2',
                    )}
                >
                    <span className="text-12-medium text-fg-secondary">
                        {filteredCount} из {totalCount}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 rounded-full px-2 text-12-medium"
                        onClick={onClearTree}
                        disabled={!hasTreeFilter}
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
                        onClear={onClearTree}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function CatalogSortMenu({
    sortMode,
    onSortModeChange,
}: {
    sortMode: SortMode;
    onSortModeChange: (mode: SortMode) => void;
}) {
    const sortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 rounded-xl md:rounded-full"
                    aria-label="Сортировка товаров"
                >
                    <ArrowUpDown className="size-4" />
                    <span className="max-w-32 truncate">{sortLabel}</span>
                    <ChevronDown className="size-3 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl p-1">
                {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => onSortModeChange(option.value)}
                        className="rounded-lg text-13-medium"
                    >
                        <span className="flex-1">{option.label}</span>
                        {sortMode === option.value && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
