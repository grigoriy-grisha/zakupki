'use client';

import { use } from 'react';
import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import {
    DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT,
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { usePurchasePaymentDetail } from './hooks';
import { ProductCard } from './components';

export default function ShopPurchasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const { data: pricingSettings } = trpc.appSettings.getPricing.useQuery();
    const paymentDetail = usePurchasePaymentDetail(id);
    const packDiscountPercent =
        pricingSettings?.beadPackPriceDiscountPercent ?? DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;

    const orderQtyMap = new Map(
        paymentDetail.myOrdersInPurchase.map((o) => [o.purchaseItemId, Number(o.quantity)]),
    );

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
                        <AppLink href="/shop">Назад к закупкам</AppLink>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const fulfillmentStatus = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];
    const isSupplement = purchase.status === 'SUPPLEMENT' || purchase.fulfillmentStatus === 'REORDER';

    return (
        <div className="space-y-6">
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
                    <Badge variant="outline">
                        <Package className="mr-1 h-3 w-3" />
                        {fulfillmentLabel}
                    </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {purchase.tag} · До{' '}
                    {new Date(purchase.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </p>
            </div>

            <p className="text-sm text-muted-foreground">Товаров: {purchase.items.length}</p>

            {/* Product grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {purchase.items.map((item) => (
                    <ProductCard
                        key={item.id}
                        item={item}
                        purchaseId={id}
                        packDiscountPercent={packDiscountPercent}
                        currentQuantity={orderQtyMap.get(item.id)}
                        isSupplement={isSupplement}
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
        </div>
    );
}
