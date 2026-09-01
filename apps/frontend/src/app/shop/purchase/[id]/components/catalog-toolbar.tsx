'use client';

import { ChevronRight, Search, ShoppingBag, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { pluralRu } from '@/lib/format/plural';
import { cn } from '@/lib/utils';

export type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

interface CatalogToolbarProps {
    query: string;
    onQueryChange: (value: string) => void;
    onlyMine: boolean;
    onOnlyMineToggle: () => void;
    showOnlyMine: boolean;
    totalCount: number;
    filteredCount: number;
    ancestorPath: { typeId: number; typeName: string; name: string }[];
    selectedFolderLabel: string | null;
    onClearTree: () => void;
    onResetAll: () => void;
    hasTreeFilter: boolean;
    mobileFilterSlot?: React.ReactNode;
}

export function CatalogToolbar({
    query,
    onQueryChange,
    onlyMine,
    onOnlyMineToggle,
    showOnlyMine,
    totalCount,
    filteredCount,
    ancestorPath,
    selectedFolderLabel,
    onClearTree,
    onResetAll,
    hasTreeFilter,
    mobileFilterSlot,
}: CatalogToolbarProps) {
    const hasQuery = query.trim() !== '';
    const hasActive = hasQuery || hasTreeFilter || onlyMine;
    const activeFilterCount = [hasQuery, hasTreeFilter, onlyMine].filter(Boolean).length;
    const showResetAll = activeFilterCount >= 2;
    const counter = hasActive
        ? `${filteredCount} из ${totalCount}`
        : `${totalCount} ${pluralRu(totalCount, ['товар', 'товара', 'товаров'])}`;

    return (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex w-full items-center gap-3 sm:w-auto">
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

                            </div>

            <div className="flex items-center justify-end gap-2 sm:flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    {mobileFilterSlot && <div className="md:hidden">{mobileFilterSlot}</div>}

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
                            <span className="hidden sm:inline">В заказе</span>
                        </button>
                    )}
                </div>

                <span className="shrink-0 text-14-medium text-secondary tabular-nums">{counter}</span>
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
                        <span key={`${segment.typeId}:${segment.name}`} className="flex items-center gap-1.5 text-fg-tertiary">
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
