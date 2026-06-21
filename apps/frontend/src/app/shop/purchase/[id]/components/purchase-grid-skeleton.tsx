'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Скелетон витрины закупки: 8 карточек в сетке 2/3/4.
 * Соответствует раскладке `ProductGrid`.
 */
export function PurchaseGridSkeleton() {
    return (
        <div
            className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
            role="list"
            aria-busy="true"
            aria-label="Загрузка товаров"
        >
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    role="listitem"
                    className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-bg-card p-3 sm:p-4"
                >
                    <Skeleton className="aspect-square w-full rounded-lg sm:aspect-[4/3]" />
                    <Skeleton className="mt-2 h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                    <Skeleton className="mt-1 h-5 w-2/5 rounded-md" />
                    <Skeleton className="mt-2 h-3 w-1/3 rounded-md" />
                    <Skeleton className="mt-3 h-9 w-full rounded-lg" />
                </div>
            ))}
        </div>
    );
}
