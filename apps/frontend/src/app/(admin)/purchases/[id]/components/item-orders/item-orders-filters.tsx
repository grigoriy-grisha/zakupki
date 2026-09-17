'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { ITEM_ORDERS_FILTERS, type ItemFilter } from '../../lib/item-orders-views';

interface ItemOrdersFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    filter: ItemFilter;
    onFilterChange: (filter: ItemFilter) => void;
}

export function ItemOrdersFilters({ search, onSearchChange, filter, onFilterChange }: ItemOrdersFiltersProps) {
    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                <Input
                    placeholder="Поиск: название, артикул, бренд, комментарий…"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-9 rounded-full pl-9 text-13-regular"
                />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {ITEM_ORDERS_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        aria-pressed={filter === f.id}
                        onClick={() => onFilterChange(f.id)}
                        className={cn(
                            'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3',
                            'text-12-bold transition-colors',
                            filter === f.id
                                ? 'border-secondary bg-secondary text-primary-foreground'
                                : 'border-border-low text-secondary hover:bg-secondary/10',
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
