'use client';

import { ArrowUpDown, Check, ChevronDown, ChevronRight, Search, ShoppingBag, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pluralRu } from '@/lib/format/plural';
import { cn } from '@/lib/utils';

export type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'default', label: 'По умолчанию' },
    { value: 'price-asc', label: 'Сначала дешевле' },
    { value: 'price-desc', label: 'Сначала дороже' },
    { value: 'name-asc', label: 'По названию' },
];

const SORT_LABELS = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label])) as Record<SortMode, string>;

interface CatalogToolbarProps {
    query: string;
    onQueryChange: (value: string) => void;
    onlyMine: boolean;
    onOnlyMineToggle: () => void;
    showOnlyMine: boolean;
    sortMode: SortMode;
    onSortModeChange: (mode: SortMode) => void;
    totalCount: number;
    filteredCount: number;
    ancestorPath: { typeId: number; typeName: string; name: string }[];
    selectedFolderLabel: string | null;
    onClearTree: () => void;
    onResetAll: () => void;
    hasTreeFilter: boolean;
}

export function CatalogToolbar({
    query,
    onQueryChange,
    onlyMine,
    onOnlyMineToggle,
    showOnlyMine,
    sortMode,
    onSortModeChange,
    totalCount,
    filteredCount,
    ancestorPath,
    selectedFolderLabel,
    onClearTree,
    onResetAll,
    hasTreeFilter,
}: CatalogToolbarProps) {
    const hasQuery = query.trim() !== '';
    const hasActive = hasQuery || hasTreeFilter || onlyMine;
    const activeFilterCount = [hasQuery, hasTreeFilter, onlyMine].filter(Boolean).length;
    const showResetAll = activeFilterCount >= 2;
    const counter = hasActive
        ? `${filteredCount} из ${totalCount}`
        : `${totalCount} ${pluralRu(totalCount, ['товар', 'товара', 'товаров'])}`;

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                    <Search
                        className={cn(
                            'pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2',
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
                            'h-10 w-full rounded-full border border-border-low bg-transparent pr-9 pl-10',
                            'text-13-regular text-fg-primary outline-none transition-colors',
                            'placeholder:text-fg-tertiary focus:border-secondary',
                        )}
                    />
                    {hasQuery && (
                        <button
                            type="button"
                            onClick={() => onQueryChange('')}
                            aria-label="Очистить поиск"
                            className={cn(
                                'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center',
                                'justify-center rounded-full text-fg-tertiary transition-colors',
                                'hover:bg-bg-soft hover:text-fg-primary',
                            )}
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                <SortMenu sortMode={sortMode} onSortModeChange={onSortModeChange} />

                {showOnlyMine && (
                    <button
                        type="button"
                        onClick={onOnlyMineToggle}
                        aria-pressed={onlyMine}
                        className={cn(
                            'flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4',
                            'text-13-medium transition-colors',
                            onlyMine
                                ? 'border-secondary bg-secondary text-primary-foreground'
                                : 'border-secondary/50 text-secondary hover:bg-secondary/10',
                        )}
                    >
                        <ShoppingBag className="size-4" />
                        В заказе
                    </button>
                )}

                <span className="ml-auto shrink-0 text-14-medium text-secondary tabular-nums">{counter}</span>
            </div>

            {hasActive && (
                <ActiveFilterChips
                    query={query}
                    onQueryChange={onQueryChange}
                    hasTreeFilter={hasTreeFilter}
                    ancestorPath={ancestorPath}
                    selectedFolderLabel={selectedFolderLabel}
                    onClearTree={onClearTree}
                    onlyMine={onlyMine}
                    onOnlyMineToggle={onOnlyMineToggle}
                    showResetAll={showResetAll}
                    onResetAll={onResetAll}
                />
            )}
        </div>
    );
}

function SortMenu({ sortMode, onSortModeChange }: { sortMode: SortMode; onSortModeChange: (mode: SortMode) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Сортировка товаров"
                    className={cn(
                        'flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border-low',
                        'px-4 text-13-medium text-fg-primary transition-colors hover:border-secondary hover:text-secondary',
                    )}
                >
                    <ArrowUpDown className="size-4" />
                    <span className="hidden max-w-32 truncate sm:inline">
                        {SORT_LABELS[sortMode]}
                    </span>
                    <ChevronDown className="size-3 opacity-60" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl p-1">
                {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => onSortModeChange(option.value)}
                        className="rounded-lg text-13-medium"
                    >
                        <span className="flex-1">{option.label}</span>
                        {sortMode === option.value && <Check className="size-3.5 text-secondary" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ActiveFilterChips({
    query,
    onQueryChange,
    hasTreeFilter,
    ancestorPath,
    selectedFolderLabel,
    onClearTree,
    onlyMine,
    onOnlyMineToggle,
    showResetAll,
    onResetAll,
}: {
    query: string;
    onQueryChange: (value: string) => void;
    hasTreeFilter: boolean;
    ancestorPath: { typeId: number; typeName: string; name: string }[];
    selectedFolderLabel: string | null;
    onClearTree: () => void;
    onlyMine: boolean;
    onOnlyMineToggle: () => void;
    showResetAll: boolean;
    onResetAll: () => void;
}) {
    const hasQuery = query.trim() !== '';

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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
                        'inline-flex items-center gap-1 rounded-full bg-bg-soft py-1 pr-1 pl-2.5',
                        'text-12-medium text-secondary',
                    )}
                >
                    В заказе
                    <button
                        type="button"
                        onClick={onOnlyMineToggle}
                        aria-label="Показать все товары"
                        className={cn(
                            'flex size-5 items-center justify-center rounded-full text-secondary/70',
                            'transition-colors hover:bg-secondary/15 hover:text-secondary',
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
                    className={cn('h-6 rounded-full px-2 text-12-medium text-fg-secondary', 'hover:text-fg-primary')}
                    onClick={onResetAll}
                >
                    Сбросить всё
                </Button>
            )}
        </div>
    );
}
