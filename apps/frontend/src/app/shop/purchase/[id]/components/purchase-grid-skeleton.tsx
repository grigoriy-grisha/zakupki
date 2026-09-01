'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PurchaseGridSkeleton() {
    return (
        <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
            role="list"
            aria-busy="true"
            aria-label="Загрузка товаров"
        >
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} role="listitem" className="flex flex-col gap-2 overflow-hidden rounded-2xl bg-bg-soft p-3 sm:p-4">
                    <Skeleton className="aspect-[6/5] w-full rounded-xl max-sm:aspect-[4/5]" />
                    <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                    <Skeleton className="mt-1 h-5 w-2/5 rounded-md" />
                    <Skeleton className="mt-2 h-10 w-full rounded-full sm:h-12" />
                </div>
            ))}
        </div>
    );
}
