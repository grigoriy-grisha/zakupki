'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PurchaseGridSkeleton() {
    return (
        <div
            className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
            role="list"
            aria-busy="true"
            aria-label="Загрузка товаров"
        >
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    role="listitem"
                    className={cn(
                        'flex flex-col gap-1.5 overflow-hidden rounded-2xl border border-border',
                        'bg-bg-card p-2.5 sm:gap-2 sm:p-3.5',
                    )}
                >
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                    <Skeleton className="mt-1 h-5 w-2/5 rounded-md" />
                    <Skeleton className="mt-2 h-3 w-1/3 rounded-md" />
                    <Skeleton className="mt-auto h-8 w-full rounded-lg sm:h-9" />
                </div>
            ))}
        </div>
    );
}
