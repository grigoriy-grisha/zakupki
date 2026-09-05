'use client';

import { Search, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { PurchaseCurrencyRateRef } from '../../lib/types';
import { ProductPickerDialog } from './product-picker-dialog';

const PUBLISHED_FILTER_OPTIONS = [
    { id: 'all', label: 'Все' },
    { id: 'published', label: 'Опубл.' },
    { id: 'unpublished', label: 'Не опубл.' },
] as const;

export type PublishedFilter = 'all' | 'published' | 'unpublished';

export function ItemsToolbar({
    search,
    onSearchChange,
    publishedFilter,
    onPublishedFilterChange,
    showPublishButton,
    publishCount,
    onPublishClick,
    canAddItems,
    purchaseId,
    purchaseTag,
    currencyRates,
}: {
    search: string;
    onSearchChange: (value: string) => void;
    publishedFilter: PublishedFilter;
    onPublishedFilterChange: (value: PublishedFilter) => void;
    showPublishButton: boolean;
    publishCount: number;
    onPublishClick: () => void;
    canAddItems: boolean;
    purchaseId: number;
    purchaseTag: string;
    currencyRates: PurchaseCurrencyRateRef[];
}) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
                <div className="relative max-w-xs flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Поиск: артикул, название, бренд или комментарий…"
                        className="rounded-full pl-9 text-13-regular"
                    />
                </div>
                <div className="hidden items-center gap-1 rounded-full bg-bg-soft p-1 sm:flex">
                    {PUBLISHED_FILTER_OPTIONS.map((opt) => (
                        <Button
                            key={opt.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => onPublishedFilterChange(opt.id)}
                            className={cn(
                                'h-7 rounded-full px-3 text-12-medium',
                                publishedFilter === opt.id
                                    ? 'bg-bg-card text-fg-primary shadow-xs hover:bg-bg-card'
                                    : 'text-fg-tertiary',
                            )}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {showPublishButton && (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={onPublishClick}>
                        <Send className="size-3.5" />
                        <span className="sm:hidden">В TG ({publishCount})</span>
                        <span className="hidden sm:inline">Опубликовать в TG ({publishCount})</span>
                    </Button>
                )}
                {canAddItems && (
                    <ProductPickerDialog
                        purchaseId={purchaseId}
                        purchaseTag={purchaseTag}
                        currencyRates={currencyRates}
                    />
                )}
            </div>
        </div>
    );
}
