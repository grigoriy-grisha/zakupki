'use client';

import {
    computeUnitPriceRubNewModel,
    type CurrencyRate,
    isSupplementPhase,
    mapToPurchaseItem,
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { ArrowLeft, Package, PackageSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import { aggregateByItem } from '../../lib/order-aggregation';
import {
    CatalogToolbar,
    pluralProducts,
    ProductGrid,
    PurchaseGridSkeleton,
    PurchaseStepper,
    type SortMode,
} from './components';
import type { ProductGridItem } from './components/product-grid';
import { usePurchasePaymentDetail } from './hooks';
import { usePurchaseFilterTree } from './hooks/use-purchase-filter-tree';

function getSortPriceRub(
    item: ProductGridItem,
    fulfillmentStatus: PurchaseFulfillmentStatus,
    packDiscountPercent: number,
    orgFeeDefaultPercent: number,
    currencyRates: CurrencyRate[],
): number | null {
    const purchaseItem = mapToPurchaseItem(
        { ...item, purchase: { fulfillmentStatus } },
        packDiscountPercent,
        { orgFeeDefaultPercent, currencyRates },
    );
    return computeUnitPriceRubNewModel(purchaseItem);
}

function comparePrices(a: number | null, b: number | null): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
}

function pluralSuppliers(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'поставщик';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'поставщика';
    return 'поставщиков';
}

export default function ShopPurchasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const router = useRouter();

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const paymentDetail = usePurchasePaymentDetail(id);
    const { beadPackPriceDiscountPercent: packDiscountPercent, orgFeeDefaultPercent } = usePricingSettings();

    const [query, setQuery] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('default');
    const [onlyMine, setOnlyMine] = useState(false);

    const fulfillmentStatus = (purchase?.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

    const currencyRates = useMemo<CurrencyRate[]>(
        () =>
            (purchase?.currencyRates ?? []).map((r) => ({
                currencyId: r.currencyId,
                rateToRub: Number(r.rateToRub),
            })),
        [purchase?.currencyRates],
    );

    const items = (purchase?.items ?? []) as ProductGridItem[];
    const {
        tree,
        selectedId,
        selectedFolderLabel,
        ancestorPath,
        expandedIds,
        filteredItems: treeItems,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount,
    } = usePurchaseFilterTree(items);
    const filteredItems = treeItems as ProductGridItem[];

    const aggregatedByItem = useMemo(
        () => aggregateByItem(paymentDetail.myOrdersInPurchase),
        [paymentDetail.myOrdersInPurchase],
    );

    const myItemIds = useMemo(() => {
        const ids = new Set<number>();
        aggregatedByItem.forEach((aggregated, itemId) => {
            if (aggregated.quantity > 0 || aggregated.packageCount > 0) {
                ids.add(itemId);
            }
        });
        return ids;
    }, [aggregatedByItem]);

    const searchedItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return filteredItems;
        return filteredItems.filter((item) => {
            const haystack = [
                item.product?.name,
                item.product?.articleNumber,
                item.product?.brand?.name,
                item.supplier?.name,
            ];
            return haystack.some((value) => typeof value === 'string' && value.toLowerCase().includes(q));
        });
    }, [filteredItems, query]);

    const visibleItems = useMemo(() => {
        let result = searchedItems;
        if (onlyMine) {
            result = result.filter((item) => myItemIds.has(item.purchaseItemId ?? item.id));
        }
        if (sortMode === 'default') {
            return result;
        }
        const withKeys = result.map((item) => ({
            item,
            price:
                sortMode === 'name-asc'
                    ? null
                    : getSortPriceRub(
                          item,
                          fulfillmentStatus,
                          packDiscountPercent,
                          orgFeeDefaultPercent,
                          currencyRates,
                      ),
            name: String(item.product?.name ?? ''),
        }));
        if (sortMode === 'name-asc') {
            withKeys.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        } else if (sortMode === 'price-asc') {
            withKeys.sort((a, b) => comparePrices(a.price, b.price));
        } else {
            withKeys.sort((a, b) => comparePrices(b.price, a.price));
        }
        return withKeys.map((entry) => entry.item);
    }, [
        searchedItems,
        onlyMine,
        myItemIds,
        sortMode,
        currencyRates,
        orgFeeDefaultPercent,
        fulfillmentStatus,
        packDiscountPercent,
    ]);

    const supplierCount = useMemo(
        () => new Set(items.map((item) => item.supplier?.name).filter(Boolean)).size,
        [items],
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-5 sm:gap-6">
                <div className="flex items-start gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-xl" />
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-5 w-28 rounded-full" />
                        <Skeleton className="h-7 w-56 rounded-md" />
                        <Skeleton className="h-4 w-72 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-14 rounded-xl md:h-12 md:rounded-2xl" />
                <PurchaseGridSkeleton />
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="rounded-2xl border border-border bg-bg-card">
                <EmptyState
                    icon={Package}
                    title="Закупка не найдена"
                    description="Возможно, она была удалена или ссылка неверная"
                    actionLabel="Назад к закупкам"
                    onAction={() => router.push('/shop')}
                />
            </div>
        );
    }

    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];
    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';

    const hasActiveFilters = query.trim() !== '' || selectedId != null || onlyMine;
    const showOnlyMine = aggregatedByItem.size > 0;

    const resetAllFilters = () => {
        setQuery('');
        setOnlyMine(false);
        clearSelection();
    };

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <header className="flex items-start gap-2 sm:gap-3">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5 shrink-0 rounded-xl"
                    asChild
                    aria-label="Назад к закупкам"
                >
                    <AppLink href="/shop">
                        <ArrowLeft className="size-4" />
                    </AppLink>
                </Button>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge type="subtle" variant={isSupplement ? 'warning' : 'success'}>
                            {isSupplement ? 'Добор' : 'Активна'}
                        </Badge>
                        <Badge type="subtle" variant="neutral">
                            {totalCount} {pluralProducts(totalCount)}
                        </Badge>
                    </div>
                    <h1 className="truncate text-h1 text-fg-primary">
                        {purchase.tag}
                    </h1>
                    <p
                        className={cn(
                            'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-13-regular text-fg-secondary',
                            'sm:text-14-regular',
                        )}
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <Package className="size-3.5 text-fg-tertiary" />
                            {fulfillmentLabel}
                        </span>
                        {supplierCount > 0 && (
                            <>
                                <span aria-hidden className="text-fg-tertiary">
                                    ·
                                </span>
                                <span>
                                    {supplierCount} {pluralSuppliers(supplierCount)}
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </header>

            <PurchaseStepper currentStatus={fulfillmentStatus} />

            <CatalogToolbar
                query={query}
                onQueryChange={setQuery}
                tree={tree}
                selectedId={selectedId}
                onSelectNode={handleSelectNode}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onClearTree={clearSelection}
                onlyMine={onlyMine}
                onOnlyMineToggle={() => setOnlyMine((value) => !value)}
                showOnlyMine={showOnlyMine}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
                totalCount={totalCount}
                filteredCount={visibleItems.length}
                ancestorPath={ancestorPath}
                selectedFolderLabel={selectedFolderLabel}
                onResetAll={resetAllFilters}
            />

            {visibleItems.length === 0 && hasActiveFilters ? (
                <div className="rounded-2xl border border-border bg-bg-card">
                    <EmptyState
                        icon={PackageSearch}
                        title="Ничего не найдено"
                        description="Измените запрос или сбросьте фильтры"
                        actionLabel="Сбросить всё"
                        onAction={resetAllFilters}
                    />
                </div>
            ) : (
                <ProductGrid
                    items={visibleItems}
                    aggregatedByItem={aggregatedByItem}
                    purchaseId={id}
                    packDiscountPercent={packDiscountPercent}
                    orgFeeDefaultPercent={orgFeeDefaultPercent}
                    currencyRates={currencyRates}
                    isSupplement={isSupplement}
                    canAddPackage={canAddPackage}
                    fulfillmentStatus={fulfillmentStatus}
                />
            )}
        </div>
    );
}
