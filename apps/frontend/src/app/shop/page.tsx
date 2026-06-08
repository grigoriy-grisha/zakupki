'use client';

import { useEffect } from 'react';
import { trpc } from '@/lib/client/trpc';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart } from 'lucide-react';

export default function ShopPage() {
    const router = useAppRouter();
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE'],
    });

    useEffect(() => {
        if (purchases && purchases.length > 0) {
            router.replace(`/shop/purchase/${purchases[0].id}`);
        }
    }, [purchases, router]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-64" />
                    ))}
                </div>
            </div>
        );
    }

    if (!purchases?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                <h2 className="mt-4 text-lg font-medium">Нет активных закупок</h2>
                <p className="mt-1 text-sm text-muted-foreground">Сейчас нет открытых закупок для участия</p>
            </div>
        );
    }

    // Will redirect via useEffect
    return null;
}
