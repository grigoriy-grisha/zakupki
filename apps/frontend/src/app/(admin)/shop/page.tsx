'use client';

import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart } from 'lucide-react';
import { usePurchasePaymentMap } from './hooks';
import { PurchaseCard, AvailablePurchaseCard } from './components';

export default function ShopPage() {
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery({ statuses: ['ACTIVE', 'SUPPLEMENT'] });
    const { map: paymentMap } = usePurchasePaymentMap();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Мои закупки</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Участвуйте в закупках и оплачивайте заказы</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-52" />
                    ))}
                </div>
            </div>
        );
    }

    if (!purchases?.length) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Мои закупки</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Участвуйте в закупках и оплачивайте заказы</p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="mt-4 text-lg font-medium">Нет активных закупок</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Сейчас нет открытых закупок для участия</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const purchasesWithOrders = purchases.filter((p) => paymentMap.has(p.id) && (paymentMap.get(p.id)?.due ?? 0) > 0);
    const purchasesWithoutOrders = purchases.filter(
        (p) => !paymentMap.has(p.id) || (paymentMap.get(p.id)?.due ?? 0) === 0,
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Мои закупки</h1>
                <p className="mt-1 text-sm text-muted-foreground">Участвуйте в закупках и оплачивайте заказы</p>
            </div>

            {purchasesWithOrders.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-medium">Ваши заказы</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {purchasesWithOrders.map((purchase) => (
                            <PurchaseCard
                                key={purchase.id}
                                purchase={purchase}
                                payment={paymentMap.get(purchase.id)!}
                            />
                        ))}
                    </div>
                </div>
            )}

            {purchasesWithoutOrders.length > 0 && (
                <div className="space-y-4">
                    {purchasesWithOrders.length > 0 && <h2 className="text-lg font-medium">Другие закупки</h2>}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {purchasesWithoutOrders.map((purchase) => (
                            <AvailablePurchaseCard key={purchase.id} purchase={purchase} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
