'use client';

import {
    ArrowUpDown,
    Check,
    ChevronDown,
    ChevronRight,
    Filter as FilterIcon,
    Search,
    ShoppingBag,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { FilterTree } from './filter-tree';
import type { TreeNode } from '@/app/(admin)/products/lib/types';

export type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'default', label: 'По умолчанию' },
    { value: 'price-asc', label: 'Сначала дешевле' },
    { value: 'price-desc', label: 'Сначала дороже' },
    { value: 'name-asc', label: 'По названию' },
];

export function pluralProducts(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'товар';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара';
    return 'товаров';
}

interface CatalogToolbarProps {
    query: string;
    onQueryChange: (value: string) => void;
    tree: TreeNode[];
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    onClearTree: () => void;
    onlyMine: boolean;
    onOnlyMineToggle: () => void;
    showOnlyMine: boolean;
    sortMode: SortMode;
    onSortModeChange: (mode: SortMode) => void;
    totalCount: number;
    filteredCount: number;
    ancestorPath: { typeId: number; typeName: string; name: string }[];
    selectedFolderLabel: string | null;
    onResetAll: () => void;
}

export function CatalogToolbar({
    query,
    onQueryChange,
    tree,
    selectedId,
    onSelectNode,
    expandedIds,
    onToggle,
    onClearTree,
    onlyMine,
    onOnlyMineToggle,
    showOnlyMine,
    sortMode,
    onSortModeChange,
    totalCount,
    filteredCount,
    ancestorPath,
    selectedFolderLabel,
    onResetAll,
}: CatalogToolbarProps) {
    const hasTree = tree.length > 0;
    const hasTreeFilter = selectedId != null;
    const hasQuery = query.trim() !== '';
    const hasActive = hasQuery || hasTreeFilter || onlyMine;
    const activeFilterCount = [hasQuery, hasTreeFilter, onlyMine].filter(Boolean).length;
    const showResetAll = activeFilterCount >= 2;
    const sortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '';
    const counter = hasActive
        ? `${filteredCount} из ${totalCount}`
        : `${totalCount} ${pluralProducts(totalCount)}`;

    return (
        <div
            className={cn(
                'sticky top-0 z-20 -mx-4 border-b border-border-soft bg-bg-base/95 px-4 py-2 backdrop-blur',
                'supports-[backdrop-filter]:bg-bg-base/75',
                'md:top-2 md:mx-0 md:rounded-2xl md:border md:border-border md:bg-bg-card/95 md:px-3 md:shadow-xs',
                'md:supports-[backdrop-filter]:bg-bg-card/85',
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex w-full min-w-0 gap-2 md:w-auto">
                    <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
                        <Search
                            className={cn(
                                'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2',
                                'text-fg-tertiary',
                            )}
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder="Поиск по товарам"
                            aria-label="Поиск по товарам"
                            className={cn(
                                'h-9 w-full rounded-xl border border-border bg-bg-card pr-8 pl-9',
                                'text-13-regular text-fg-primary outline-none transition-colors',
                                'placeholder:text-fg-tertiary focus:border-primary/50',
                                'focus:ring-2 focus:ring-primary/15',
                            )}
                        />
                        {hasQuery && (
                            <button
                                type="button"
                                onClick={() => onQueryChange('')}
                                aria-label="Очистить поиск"
                                className={cn(
                                    'absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center',
                                    'justify-center rounded-full text-fg-tertiary transition-colors',
                                    'hover:bg-bg-soft hover:text-fg-primary',
                                )}
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>

                    {hasTree && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        'h-9 shrink-0 rounded-xl px-0 md:rounded-full md:px-4',
                                        hasTreeFilter &&
                                            'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
                                    )}
                                    aria-label="Фильтр товаров"
                                >
                                    <FilterIcon className="size-4" />
                                    <span className="hidden md:inline">Фильтр</span>
                                    {hasTreeFilter && (
                                        <span className="hidden size-1.5 rounded-full bg-primary md:inline" />
                                    )}
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
                    )}
                </div>

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

                {showOnlyMine && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOnlyMineToggle}
                        aria-pressed={onlyMine}
                        className={cn(
                            'h-9 shrink-0 rounded-xl md:rounded-full',
                            onlyMine && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
                        )}
                    >
                        <ShoppingBag className="size-4" />
                        В заказе
                    </Button>
                )}

                <span className="ml-auto shrink-0 text-12-regular text-fg-secondary tabular-nums">{counter}</span>
            </div>

            {hasActive && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {hasQuery && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full bg-bg-soft py-1 pr-1 pl-2.5',
                                'text-12-medium text-fg-secondary',
                            )}
                        >
                            <span className="max-w-40 truncate">«{query.trim()}»</span>
                            <button
                                type="button"
                                onClick={() => onQueryChange('')}
                                aria-label="Сбросить поисковый запрос"
                                className={cn(
                                    'flex size-5 items-center justify-center rounded-full text-fg-tertiary',
                                    'transition-colors hover:bg-border-soft hover:text-fg-primary',
                                )}
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    )}

                    {hasTreeFilter && (
                        <>
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
                                className={cn(
                                    'h-6 rounded-full px-2 text-12-medium text-fg-secondary',
                                    'hover:text-fg-primary',
                                )}
                                onClick={onClearTree}
                                aria-label="Сбросить фильтр"
                            >
                                <X className="size-3" />
                                Сбросить
                            </Button>
                        </>
                    )}

                    {onlyMine && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-2.5',
                                'text-12-medium text-primary',
                            )}
                        >
                            В заказе
                            <button
                                type="button"
                                onClick={onOnlyMineToggle}
                                aria-label="Показать все товары"
                                className={cn(
                                    'flex size-5 items-center justify-center rounded-full text-primary/70',
                                    'transition-colors hover:bg-primary/15 hover:text-primary',
                                )}
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    )}

                    {showResetAll && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                'h-6 rounded-full px-2 text-12-medium text-fg-secondary',
                                'hover:text-fg-primary',
                            )}
                            onClick={onResetAll}
                        >
                            Сбросить всё
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
