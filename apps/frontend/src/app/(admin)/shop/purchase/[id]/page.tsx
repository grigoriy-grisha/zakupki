'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check } from 'lucide-react';
import { usePurchasePaymentDetail } from '../../hooks';
import { QuantityModal, ProductCard, OrdersSummaryCard, PaymentDialog } from './components';

export default function ShopPurchasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const [selectedItem, setSelectedItem] = useState<number | null>(null);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const paymentDetail = usePurchasePaymentDetail(id);

    const orderedItems = new Set(paymentDetail.myOrdersInPurchase.map((o) => o.purchaseItemId));

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-264" />
                    ))}
                </div>
            </div>
        );
    }

    if (!purchase) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center py-16">
                    <h2 className="text-lg font-medium">Закупка не найдена</h2>
                    <Button variant="outline" className="mt-4" asChild>
                        <Link href="/shop">Назад к закупкам</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/shop">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">{purchase.supplier}</h1>
                        <Badge
                            className={
                                purchase.status === 'SUPPLEMENT'
                                    ? 'bg-warning-50 text-warning'
                                    : 'bg-success-50 text-success'
                            }
                        >
                            {purchase.status === 'SUPPLEMENT' ? 'Добор' : 'Активна'}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {purchase.tag} · До{' '}
                        {new Date(purchase.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Товаров: {purchase.items.length}</p>
                {orderedItems.size > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                        <Check className="mr-1 h-3 w-3" />
                        Вы заказываете {orderedItems.size} поз.
                    </Badge>
                )}
            </div>

            {/* Orders summary + payment */}
            {paymentDetail.myOrdersInPurchase.length > 0 && (
                <OrdersSummaryCard
                    paymentDetail={paymentDetail}
                    paymentDialog={
                        <PaymentDialog
                            purchaseId={id}
                            remaining={paymentDetail.remaining}
                            hasPending={paymentDetail.hasPending}
                        />
                    }
                />
            )}

            {/* Product grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {purchase.items.map((item) => (
                    <ProductCard
                        key={item.id}
                        item={item}
                        isOrdered={orderedItems.has(item.id)}
                        isSupplement={purchase.status === 'SUPPLEMENT'}
                        onSelect={setSelectedItem}
                    />
                ))}
            </div>

            {purchase.items.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center py-16">
                        <h2 className="text-lg font-medium">Пока нет товаров</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Администратор ещё не добавил товары в эту закупку
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Quantity Modal */}
            {selectedItem !== null && (
                <QuantityModal
                    purchaseItemId={selectedItem}
                    purchaseId={id}
                    currentQuantity={(() => {
                        const order = paymentDetail.myOrders?.find((o) => o.purchaseItemId === selectedItem);
                        return order ? Number(order.quantity) : undefined;
                    })()}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}
