'use client';

import { use } from 'react';
import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ChevronRight, X } from 'lucide-react';
import {
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { cn } from '@/lib/utils';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { usePurchasePaymentDetail } from './hooks';
import { usePurchaseFilterTree } from './hooks/use-purchase-filter-tree';
import { ProductCard } from './components';
import { FilterTree } from './components/filter-tree';

export default function ShopPurchasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const paymentDetail = usePurchasePaymentDetail(id);
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const items = purchase?.items ?? [];
    const {
        tree,
        selectedPath,
        selectedId,
        selectedFolderLabel,
        ancestorPath,
        expandedIds,
        filteredItems,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount,
    } = usePurchaseFilterTree(items);

    const orderQtyMap = new Map(paymentDetail.myOrdersInPurchase.map((o) => [o.purchaseItemId, Number(o.quantity)]));
    // baseQuantity — замороженное количество при входе в SUPPLEMENT
    const orderBaseQuantityMap = new Map(
        paymentDetail.myOrdersInPurchase.map((o: any) => [
            o.purchaseItemId,
            o.baseQuantity != null ? Number(o.baseQuantity) : 0,
        ]),
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
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
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{purchase.tag}</h1>
                    <Badge
                        className={
                            'text-sm px-2.5 py-0.5 ' +
                            (purchase.status === 'SUPPLEMENT'
                                ? 'bg-warning-50 text-warning'
                                : 'bg-success-50 text-success')
                        }
                    >
                        {purchase.status === 'SUPPLEMENT' ? 'Добор' : 'Активна'}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-2.5 py-0.5">
                        <Package className="mr-1 h-3.5 w-3.5" />
                        {fulfillmentLabel}
                    </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
                    <span>{purchase.supplier}</span>
                    <span>·</span>
                    <span>
                        До {new Date(purchase.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                </div>
            </div>

            {items.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center py-16">
                        <h2 className="text-lg font-medium">Пока нет товаров</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Администратор ещё не добавил товары в эту закупку
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex gap-6">
                    {tree.length > 0 && (
                        <div className="hidden w-62 shrink-0 lg:block">
                            <FilterTree
                                nodes={tree}
                                selectedId={selectedId}
                                onSelect={handleSelectNode}
                                expandedIds={expandedIds}
                                onToggle={handleToggle}
                                totalCount={totalCount}
                                onClear={clearSelection}
                            />
                        </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-4">
                        {selectedId != null && (
                            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                                {ancestorPath.map((segment, i) => (
                                    <span
                                        key={`${segment.typeId}:${segment.name}`}
                                        className="flex items-center gap-1.5"
                                    >
                                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                        <span>
                                            <span className="text-muted-foreground">{segment.typeName}:</span>{' '}
                                            {segment.name}
                                        </span>
                                    </span>
                                ))}
                                {selectedFolderLabel != null && (
                                    <span className="flex items-center gap-1.5">
                                        {ancestorPath.length > 0 && (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        <span className="font-medium">{selectedFolderLabel}</span>
                                    </span>
                                )}
                                {selectedPath.map((segment, i) => (
                                    <span
                                        key={`${segment.typeId}:${segment.name}`}
                                        className="flex items-center gap-1.5"
                                    >
                                        {(ancestorPath.length > 0 || i > 0) && (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        <span
                                            className={cn(
                                                i === selectedPath.length - 1 &&
                                                    selectedFolderLabel == null &&
                                                    'font-medium',
                                            )}
                                        >
                                            <span className="text-muted-foreground">{segment.typeName}:</span>{' '}
                                            {segment.name}
                                        </span>
                                    </span>
                                ))}
                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={clearSelection}>
                                    <X className="mr-1 h-3.5 w-3.5" />
                                    Сбросить
                                </Button>
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">Товаров: {filteredItems.length}</p>

                        <div className="grid grid-cols-2 items-stretch gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredItems.map((item: any) => (
                                <ProductCard
                                    key={item.id}
                                    item={{ ...item, quantity: orderQtyMap.get(item.id) ?? 0 }}
                                    purchaseId={id}
                                    packDiscountPercent={packDiscountPercent}
                                    baseQuantity={orderBaseQuantityMap.get(item.id) ?? undefined}
                                    isSupplement={isSupplement}
                                />
                            ))}
                        </div>

                        {filteredItems.length === 0 && (
                            <Card>
                                <CardContent className="flex flex-col items-center py-12">
                                    <h2 className="text-lg font-medium">Нет товаров в этой категории</h2>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
