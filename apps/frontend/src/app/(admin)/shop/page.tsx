'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/client/trpc';
import { AvailablePurchaseCard, PurchaseCard, ShopGridSkeleton, EmptyState } from './components';
import { usePurchasePaymentMap } from './hooks';

export default function ShopPage() {
    const [tab, setTab] = useState<'active' | 'past'>('active');

    const { data: activePurchases, isLoading: activeLoading } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE', 'SUPPLEMENT'],
    });

    const { data: myPastPurchases, isLoading: pastLoading } = trpc.purchases.listMyCompleted.useQuery();

    const { map: paymentMap } = usePurchasePaymentMap();

    const purchasesWithOrders =
        activePurchases?.filter((p) => paymentMap.has(p.id) && (paymentMap.get(p.id)?.due ?? 0) > 0) ?? [];
    const purchasesWithoutOrders =
        activePurchases?.filter((p) => !paymentMap.has(p.id) || (paymentMap.get(p.id)?.due ?? 0) === 0) ?? [];

    const isLoading = tab === 'active' ? activeLoading : pastLoading;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Мои закупки</h1>
                <p className="mt-1 text-sm text-muted-foreground">Участвуйте в закупках и оплачивайте заказы</p>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'past')}>
                <TabsList>
                    <TabsTrigger value="active">Активные закупки</TabsTrigger>
                    <TabsTrigger value="past">Мои завершённые</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 space-y-6">
                    {activeLoading ? (
                        <ShopGridSkeleton />
                    ) : !activePurchases?.length ? (
                        <EmptyState
                            title="Нет активных закупок"
                            description="Сейчас нет открытых закупок для участия"
                        />
                    ) : (
                        <>
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
                                    {purchasesWithOrders.length > 0 && (
                                        <h2 className="text-lg font-medium">Другие закупки</h2>
                                    )}
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {purchasesWithoutOrders.map((purchase) => (
                                            <AvailablePurchaseCard key={purchase.id} purchase={purchase} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>

                <TabsContent value="past" className="mt-4">
                    {isLoading ? (
                        <ShopGridSkeleton />
                    ) : !myPastPurchases?.length ? (
                        <EmptyState
                            title="Нет завершённых закупок"
                            description="Здесь появятся ваши завершённые закупки с заказами"
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {myPastPurchases.map((purchase) => {
                                const payment = paymentMap.get(purchase.id) ?? {
                                    due: 0,
                                    paid: 0,
                                    hasPending: false,
                                    remaining: 0,
                                };
                                return (
                                    <PurchaseCard key={purchase.id} purchase={purchase} payment={payment} />
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
