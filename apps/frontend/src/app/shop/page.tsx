'use client';

import { useEffect } from 'react';
import { ShoppingCartIcon } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useAppRouter } from '@/lib/hooks/use-app-router';

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
            <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-64 rounded-md" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!purchases?.length) {
        return (
            <EmptyState
                icon={ShoppingCartIcon}
                title="Нет активных закупок"
                description="Сейчас нет открытых закупок для участия"
            />
        );
    }

    return null;
}
