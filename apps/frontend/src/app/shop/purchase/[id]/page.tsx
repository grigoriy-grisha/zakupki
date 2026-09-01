'use client';

import {
    computeUnitPriceRubNewModel,
    type CurrencyRate,
    isSupplementPhase,
    mapToPurchaseItem,
        type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { ChevronLeft, ChevronRight, Package, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useRef, useState } from 'react';

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
    type SortMode,
} from './components';
import type { ProductGridItem } from './components/product-grid';
import { getPurchaseStageLabel } from './components/purchase-stepper';
import { usePurchasePaymentDetail } from './hooks';
import { usePurchaseFilterTree } from './hooks/use-purchase-filter-tree';

const PAGE_SIZE = 20;

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
    const sortMode: SortMode = 'default';
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

    const [page, setPage] = useState(1);
    const gridRef = useRef<HTMLDivElement | null>(null);

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

    const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedItems = useMemo(
        () => visibleItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [visibleItems, currentPage],
    );

    useEffect(() => {
        setPage(1);
    }, [query, selectedId, onlyMine, id]);

    const handlePageChange = (next: number) => {
        setPage(next);
        gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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

    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const stageLabel = getPurchaseStageLabel(fulfillmentStatus);

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
                <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:items-center sm:gap-3">
                    <span
                        className={cn(
                            'inline-flex h-7 items-center justify-self-start self-end rounded-full border border-secondary px-3.5',
                            'text-12-medium text-secondary sm:h-9 sm:self-auto sm:px-5 sm:text-14-medium',
                        )}
                    >
                        {stageLabel}
                    </span>
                    <h1 className="min-w-0 truncate text-center text-h1 text-secondary sm:whitespace-normal sm:text-left">
                        {purchase.tag}
                    </h1>
                    <span
                        aria-hidden
                        className={cn(
                            'inline-flex h-7 items-center rounded-full border border-secondary px-3.5 text-12-medium text-secondary',
                            'invisible sm:h-9 sm:hidden sm:px-5 sm:text-14-medium',
                        )}
                    >
                        {stageLabel}
                    </span>
                </div>
            </div>

            <div className="md:hidden">
                <PurchaseSelect currentPurchaseId={id} />
            </div>

            <CatalogToolbar
                query={query}
                onQueryChange={setQuery}
                onlyMine={onlyMine}
                onOnlyMineToggle={() => setOnlyMine((value) => !value)}
                showOnlyMine={showOnlyMine}
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
                                'bg-white/85 shadow-lg ring-1 ring-black/5 backdrop-blur-md',
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
                <div ref={gridRef} className="scroll-mt-20">
                    <ProductGrid
                        items={pagedItems}
                        aggregatedByItem={aggregatedByItem}
                        purchaseId={id}
                        packDiscountPercent={packDiscountPercent}
                        orgFeeDefaultPercent={orgFeeDefaultPercent}
                        currencyRates={currencyRates}
                        isSupplement={isSupplement}
                        canAddPackage={fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER'}
                        fulfillmentStatus={fulfillmentStatus}
                    />

                    {totalPages > 1 && (
                        <CatalogPagination
                            page={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function CatalogPagination({
    page,
    totalPages,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    const pages: (number | '…')[] = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
            pages.push(p);
        } else if (pages[pages.length - 1] !== '…') {
            pages.push('…');
        }
    }

    const btnClass = (active: boolean) =>
        cn(
            'flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-13-medium tabular-nums transition-colors',
            active ? 'bg-secondary text-primary-foreground' : 'text-secondary hover:bg-secondary/10',
        );

    return (
        <nav className="flex items-center justify-center gap-1.5 pt-1" aria-label="Страницы товаров">
            <button
                type="button"
                aria-label="Предыдущая страница"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
                className={cn(btnClass(false), 'px-1.5 disabled:pointer-events-none disabled:opacity-40')}
            >
                <ChevronLeft className="size-4" />
            </button>
            {pages.map((p, i) =>
                p === '…' ? (
                    <span key={`dots-${i}`} className="px-1 text-13-medium text-fg-tertiary">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        aria-current={p === page ? 'page' : undefined}
                        onClick={() => onPageChange(p)}
                        className={btnClass(p === page)}
                    >
                        {p}
                    </button>
                ),
            )}
            <button
                type="button"
                aria-label="Следующая страница"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
                className={cn(btnClass(false), 'px-1.5 disabled:pointer-events-none disabled:opacity-40')}
            >
                <ChevronRight className="size-4" />
            </button>
        </nav>
    );
}
