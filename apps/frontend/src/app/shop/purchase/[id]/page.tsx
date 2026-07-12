'use client';

import { use, useMemo } from 'react';
import { Package } from 'lucide-react';
import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus, isSupplementPhase } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';

import { aggregateByItem } from '../../lib/order-aggregation';
import { usePurchaseFilterTree } from './hooks/use-purchase-filter-tree';
import { usePurchasePaymentDetail } from './hooks';
import { FilterBar, ProductGrid, PurchaseGridSkeleton, PurchaseStepper } from './components';
import type { ProductGridItem } from './components/product-grid';

export default function ShopPurchasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const paymentDetail = usePurchasePaymentDetail(id);
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const items = (purchase?.items ?? []) as ProductGridItem[];
    const {
        tree,
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

    const aggregatedByItem = useMemo(
        () => aggregateByItem(paymentDetail.myOrdersInPurchase),
        [paymentDetail.myOrdersInPurchase],
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <div className="space-y-3">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-8 w-72 rounded-md" />
                    <Skeleton className="h-4 w-96 rounded-md" />
                </div>
                <PurchaseGridSkeleton />
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-bg-card py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-soft text-fg-secondary">
                    <Package className="size-5" />
                </div>
                <h2 className="text-18-semibold text-fg-primary">Закупка не найдена</h2>
                <Button variant="outline" className="mt-2 rounded-full" asChild>
                    <AppLink href="/shop">Назад к закупкам</AppLink>
                </Button>
            </div>
        );
    }

    const fulfillmentStatus = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];
    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';

    const activityBadge = (
        <Badge type="subtle" size="default" variant={isSupplement ? 'warning' : 'success'}>
            {isSupplement ? 'Добор' : 'Активна'}
        </Badge>
    );

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <PageHeader
                title={purchase.tag}
                description={
                    <span className="inline-flex items-center gap-1.5">
                        <Package className="size-3.5 text-fg-tertiary" />
                        {fulfillmentLabel}
                    </span>
                }
                badge={<div className="flex flex-wrap items-center gap-2">{activityBadge}</div>}
            />

            <PurchaseStepper currentStatus={fulfillmentStatus} />

            <FilterBar
                tree={tree}
                selectedId={selectedId}
                onSelectNode={handleSelectNode}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onClear={clearSelection}
                totalCount={totalCount}
                filteredCount={filteredItems.length}
                ancestorPath={ancestorPath}
                selectedFolderLabel={selectedFolderLabel}
            />

            <ProductGrid
                items={filteredItems}
                aggregatedByItem={aggregatedByItem}
                purchaseId={id}
                packDiscountPercent={packDiscountPercent}
                isSupplement={isSupplement}
                canAddPackage={canAddPackage}
                fulfillmentStatus={fulfillmentStatus}
            />
        </div>
    );
}
