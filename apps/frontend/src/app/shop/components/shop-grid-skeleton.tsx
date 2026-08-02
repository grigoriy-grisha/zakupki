import { Skeleton } from '@/components/ui/skeleton';

export function ShopGridSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-52" />
            ))}
        </div>
    );
}
