'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PurchaseGridSkeleton() {
    return (
        <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
            aria-busy="true"
            aria-label="Загрузка товаров"
        >
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    role="listitem"
                    className="flex flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-bg-soft max-sm:flex-row"
                >
                    <Skeleton className="aspect-[6/5] w-full shrink-0 rounded-none max-sm:aspect-auto max-sm:h-36 max-sm:w-[45%] max-sm:self-stretch" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
                        <Skeleton className="h-5 w-4/5 rounded-md" />
                        <Skeleton className="h-5 w-3/5 rounded-md" />
                        <Skeleton className="mt-1 h-4 w-1/2 rounded-md" />
                        <Skeleton className="mt-auto h-12 w-full rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
