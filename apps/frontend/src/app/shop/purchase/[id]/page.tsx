'use client';

import {
    computeUnitPriceRubNewModel,
    type CurrencyRate,
    isSupplementPhase,
    mapToPurchaseItem,
    PURCHASE_FULFILLMENT_LABELS,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { Package, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/icons';
import { FilterTree } from '@/components/shared/filter-tree';
import { useSidebarSlotContent } from '@/components/shop/sidebar-slot';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import { aggregateByItem } from '../../lib/order-aggregation';
import {
    CatalogFilterBlock,
    CatalogToolbar,
    ProductGrid,
    PurchaseGridSkeleton,
    PurchaseSelect,
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
    const purchaseItem = mapToPurchaseItem({ ...item, purchase: { fulfillmentStatus } }, packDiscountPercent, {
        orgFeeDefaultPercent,
        currencyRates,
    });
    return computeUnitPriceRubNewModel(purchaseItem);
}

function comparePrices(a: number | null, b: number | null): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
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

    const hasActiveFilters = query.trim() !== '' || selectedId != null || onlyMine;
    const showOnlyMine = aggregatedByItem.size > 0;

    const resetAllFilters = () => {
        setQuery('');
        setOnlyMine(false);
        clearSelection();
    };

    useSidebarSlotContent(
        () => (
            <div className="mt-8 border-t border-secondary/40 pt-6">
                <CatalogFilterBlock
                    tree={tree}
                    selectedId={selectedId}
                    onSelectNode={handleSelectNode}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onClearTree={clearSelection}
                    totalCount={totalCount}
                    filteredCount={visibleItems.length}
                />
            </div>
        ),
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 sm:gap-8">
                <div className="flex flex-col items-center gap-5">
                    <Skeleton className="h-24 w-[124px] rounded-2xl sm:h-40 sm:w-[224px]" />
                    <Skeleton className="h-9 w-32 rounded-full" />
                    <Skeleton className="h-9 w-48" />
                </div>
                <Skeleton className="h-16 rounded-full sm:h-[68px]" />
                <Skeleton className="h-10 w-full rounded-full" />
                <PurchaseGridSkeleton />
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="rounded-2xl bg-bg-soft">
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

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col items-center gap-5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
                <div className="flex flex-col items-center gap-3 sm:order-1 sm:items-start sm:gap-4">
                    <span
                        className={cn(
                            'inline-flex h-9 items-center rounded-full border border-secondary px-5',
                            'text-13-medium text-secondary sm:text-14-medium',
                        )}
                    >
                        {isSupplement ? 'Добор' : fulfillmentLabel}
                    </span>
                    <h1 className="text-h1 text-secondary">{purchase.tag}</h1>
                </div>

                <BrandLogo className="order-first w-[124px] animate-fade-in-up text-primary sm:order-2 sm:w-[224px]" />
            </div>

            <PurchaseStepper currentStatus={fulfillmentStatus} />

            <div className="md:hidden">
                <PurchaseSelect currentPurchaseId={id} />
            </div>

            <CatalogToolbar
                query={query}
                onQueryChange={setQuery}
                onlyMine={onlyMine}
                onOnlyMineToggle={() => setOnlyMine((value) => !value)}
                showOnlyMine={showOnlyMine}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
                totalCount={totalCount}
                filteredCount={visibleItems.length}
                ancestorPath={ancestorPath}
                selectedFolderLabel={selectedFolderLabel}
                onClearTree={clearSelection}
                onResetAll={resetAllFilters}
                hasTreeFilter={selectedId != null}
                mobileFilterSlot={
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                aria-label="Фильтр товаров"
                                className={cn(
                                    'flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4',
                                    'text-13-medium transition-colors',
                                    selectedId != null
                                        ? 'border-secondary bg-secondary text-primary-foreground'
                                        : 'border-border-low text-fg-primary hover:border-secondary hover:text-secondary',
                                )}
                            >
                                <SlidersHorizontal className="size-4" />
                                Фильтр
                                {selectedId != null && (
                                    <span className="text-12-medium tabular-nums">
                                        {visibleItems.length} из {totalCount}
                                    </span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            sideOffset={8}
                            className={cn(
                                'w-72 max-w-[calc(100vw-2rem)] rounded-2xl border-0 p-3',
                                'bg-white/75 shadow-xl ring-1 ring-black/5 backdrop-blur-xl',
                            )}
                        >
                            <FilterTree
                                compact
                                nodes={tree}
                                selectedId={selectedId}
                                onSelect={handleSelectNode}
                                expandedIds={expandedIds}
                                onToggle={handleToggle}
                                totalCount={totalCount}
                                onClear={clearSelection}
                            />
                        </PopoverContent>
                    </Popover>
                }
            />

            {visibleItems.length === 0 && hasActiveFilters ? (
                <div className="rounded-2xl bg-bg-soft">
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
                    canAddPackage={fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER'}
                    fulfillmentStatus={fulfillmentStatus}
                />
            )}
        </div>
    );
}
