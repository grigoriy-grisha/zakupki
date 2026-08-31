'use client';

import { use, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Building2, Minus, Package, PackageSearch, Percent, Plus } from 'lucide-react';
import type { CurrencyRate } from '@zakupki/types';

import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { buildStepHint } from '@/app/shop/lib/format-step-hint';
import type { ShopPurchaseItem } from '@/app/shop/lib/types';
import { AppLink } from '@/components/app-link';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { trpc } from '@/lib/client/trpc';
import {
    buildShopItemDescriptionRows,
    type ProductCatalogCardSource,
    type ProductLabelSource,
} from '@/lib/product-label';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

import { aggregateUserLines } from '../../../../lib/order-aggregation';

type ItemOrderControls = ReturnType<typeof useItemOrderControls>;

interface ItemDetailProduct extends ProductLabelSource {
    photos?: { id: number }[];
}

function formatRubles(value: number): string {
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

function formatQty(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(3).replace(/\.?0+$/, '');
}

function pluralPacks(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'пачку';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пачки';
    return 'пачек';
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
    const { id: purchaseIdStr, itemId: itemIdStr } = use(params);
    const purchaseId = Number(purchaseIdStr);
    const purchaseItemId = Number(itemIdStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { beadPackPriceDiscountPercent: packDiscountPercent, orgFeeDefaultPercent } = usePricingSettings();

    if (isLoading || !purchase) {
        return (
            <div className="flex flex-col gap-5 sm:gap-6">
                <Skeleton className="h-8 w-44 rounded-lg" />
                <div
                    className={cn(
                        'flex flex-col gap-5 sm:gap-6',
                        'lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6',
                        'xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-8',
                    )}
                >
                    <div className="flex flex-col gap-5 sm:gap-6">
                        <Skeleton className="aspect-square w-full rounded-2xl" />
                        <Skeleton className="h-40 w-full rounded-2xl" />
                    </div>
                    <Skeleton className="h-72 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <ItemDetailContent
            purchase={purchase}
            purchaseId={purchaseId}
            purchaseItemId={purchaseItemId}
            packDiscountPercent={packDiscountPercent}
            orgFeeDefaultPercent={orgFeeDefaultPercent}
        />
    );
}

function ItemDetailContent({
    purchase,
    purchaseId,
    purchaseItemId,
    packDiscountPercent,
    orgFeeDefaultPercent,
}: {
    purchase: any;
    purchaseId: number;
    purchaseItemId: number;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
}) {
    const router = useRouter();
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();

    const currencyRates = useMemo<CurrencyRate[]>(
        () =>
            (purchase?.currencyRates ?? []).map((r: any) => ({
                currencyId: r.currencyId,
                rateToRub: Number(r.rateToRub),
            })),
        [purchase?.currencyRates],
    );

    const item = purchase.items.find((i: any) => i.id === purchaseItemId) as ShopPurchaseItem | undefined;

    const myOrdersForItem = useMemo(
        () => (myOrders ?? []).filter((o: any) => o.purchaseItem?.purchaseId === purchase.id),
        [myOrders, purchase.id],
    );
    const aggregated = useMemo(
        () => aggregateUserLines(myOrdersForItem as never, purchaseItemId),
        [myOrdersForItem, purchaseItemId],
    );

    const fulfillmentStatus: string = purchase?.fulfillmentStatus ?? 'COLLECTION';
    const product = item?.product as ItemDetailProduct | undefined;

    if (!item || !product) {
        return (
            <div className="rounded-2xl border border-border bg-bg-card">
                <EmptyState
                    icon={PackageSearch}
                    title="Товар не найден"
                    description="Возможно, его удалили из закупки или скрыли."
                    actionLabel="Вернуться к закупке"
                    onAction={() => router.push(`/shop/purchase/${purchaseId}`)}
                />
            </div>
        );
    }

    return (
        <ItemDetailLoaded
            purchase={purchase}
            purchaseId={purchaseId}
            item={item}
            product={product}
            attributeTypes={attributeTypes}
            currentQuantity={aggregated.quantity}
            currentPackageCount={aggregated.packageCount}
            baseQuantity={aggregated.baseQuantity}
            fulfillmentStatus={fulfillmentStatus}
            packDiscountPercent={packDiscountPercent}
            orgFeeDefaultPercent={orgFeeDefaultPercent}
            currencyRates={currencyRates}
        />
    );
}

function ItemDetailLoaded({
    purchase,
    purchaseId,
    item,
    product,
    attributeTypes,
    currentQuantity,
    currentPackageCount,
    baseQuantity,
    fulfillmentStatus,
    packDiscountPercent,
    orgFeeDefaultPercent,
    currencyRates,
}: {
    purchase: any;
    purchaseId: number;
    item: ShopPurchaseItem;
    product: ItemDetailProduct;
    attributeTypes: any;
    currentQuantity: number;
    currentPackageCount: number;
    baseQuantity: number;
    fulfillmentStatus: string;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
    currencyRates: CurrencyRate[];
}) {
    const ctx = useItemOrderControls({
        purchaseId,
        purchaseItemId: item.id,
        item,
        currentQuantity,
        currentPackageCount,
        baseQuantity,
        fulfillmentStatus,
        packDiscountPercent,
        orgFeeDefaultPercent,
        currencyRates,
    });

    const photoIds = (product.photos ?? []).map((p: { id: number }) => p.id);
    const minHint = buildStepHint(item, fulfillmentStatus, ctx.shortName);
    const descriptionRows = buildShopItemDescriptionRows(product as ProductCatalogCardSource, attributeTypes);
    const supplierName = item.supplier?.name;
    const showMobileBar = !ctx.isSoldOut || ctx.hasOrder;

    return (
        <div className="flex flex-col gap-4 sm:gap-5">
            <Button variant="ghost" size="sm" asChild className="-ml-2 self-start text-fg-secondary">
                <AppLink href={`/shop/purchase/${purchaseId}`}>
                    <ArrowLeft className="size-4" />
                    {purchase.tag}
                </AppLink>
            </Button>

            <div
                className={cn(
                    'flex flex-col gap-5 sm:gap-6',
                    'lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6',
                    'xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-8',
                )}
            >
                <div
                    className={cn(
                        'order-2 flex min-w-0 flex-col gap-5 sm:gap-6',
                        'lg:order-none lg:col-start-1 lg:row-start-1',
                    )}
                >
                    <ItemGallery photoIds={photoIds} alt={product.name} />

                    {descriptionRows.length > 0 && (
                        <SectionCard title="Характеристики">
                            <dl className="px-4 sm:px-5">
                                {descriptionRows.map((row, index) => (
                                    <div
                                        key={row.label}
                                        className={cn(
                                            'flex items-baseline justify-between gap-4 py-2.5',
                                            index < descriptionRows.length - 1 && 'border-b border-border-soft',
                                        )}
                                    >
                                        <dt className="shrink-0 text-13-regular text-fg-secondary">{row.label}</dt>
                                        <dd className="min-w-0 text-right text-13-medium text-fg-primary">
                                            {row.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </SectionCard>
                    )}
                </div>

                <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-5">
                    <div className="order-1 min-w-0">
                        <PurchaseProductLabel
                            product={product}
                            className="min-w-0"
                            primaryClassName="block text-18-semibold leading-tight text-fg-primary sm:text-24-semibold"
                            secondaryClassName="mt-1 block text-13-regular text-fg-tertiary"
                        />
                        {(supplierName || ctx.freeRemainderLabel) && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {supplierName && (
                                    <Badge type="subtle" variant="neutral" size="sm">
                                        <Building2 className="size-3" />
                                        {supplierName}
                                    </Badge>
                                )}
                                {ctx.freeRemainderLabel && (
                                    <Badge type="subtle" variant="warning" size="sm">
                                        {ctx.freeRemainderLabel}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="order-3 lg:sticky lg:top-6">
                        <ItemBuyPanel ctx={ctx} minHint={minHint} />
                    </div>
                </div>
            </div>

            {showMobileBar && <MobileOrderBar ctx={ctx} />}
            {showMobileBar && <div className="h-20 shrink-0 lg:hidden" aria-hidden />}
        </div>
    );
}

function ItemGallery({ photoIds, alt }: { photoIds: number[]; alt: string }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activePhotoId = photoIds[activeIndex] ?? null;

    return (
        <div className="min-w-0">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-bg-soft">
                {activePhotoId != null ? (
                    <ProductPhotoPreview photoId={activePhotoId} photoIds={photoIds} alt={alt} fill zoomSize="lg" />
                ) : (
                    <div className="flex size-full items-center justify-center">
                        <Package className="size-12 text-fg-disabled" />
                    </div>
                )}
            </div>
            {photoIds.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {photoIds.map((photoId, index) => (
                        <button
                            key={photoId}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className={cn(
                                'size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:size-20',
                                index === activeIndex
                                    ? 'border-primary opacity-100'
                                    : 'border-transparent opacity-60 hover:opacity-100',
                            )}
                            aria-label={`Фото ${index + 1}`}
                            aria-current={index === activeIndex}
                        >
                            <img
                                src={absoluteProductPhotoUrl(photoId)}
                                alt=""
                                loading="lazy"
                                draggable={false}
                                className="size-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-bg-card">
            <h2 className="border-b border-border-soft px-4 py-3 text-14-semibold text-fg-primary sm:px-5">
                {title}
            </h2>
            {children}
        </section>
    );
}

function ItemBuyPanel({ ctx, minHint }: { ctx: ItemOrderControls; minHint: string | null }) {
    const price = ctx.unitPriceRub ?? ctx.price;
    const packInfo = ctx.packDiscountInfo;
    const soldOutNoOrder = ctx.isSoldOut && !ctx.hasOrder;
    const orderingClosedNoOrder = ctx.orderingClosed && !ctx.hasOrder;

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-card p-4 shadow-xs sm:p-5">
            {price > 0 && (
                <div>
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-24-semibold tabular-nums text-fg-primary">{formatRubles(price)}</span>
                        <span className="text-13-regular text-fg-tertiary">/ {ctx.shortName}</span>
                    </div>
                    {packInfo && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-success/10 px-2.5 py-2">
                            <Percent className="size-3.5 shrink-0 text-success" />
                            <p className="min-w-0 flex-1 text-12-medium text-fg-secondary">
                                Пачка {formatQty(packInfo.packSize)} {ctx.shortName} —{' '}
                                <span className="line-through text-fg-tertiary">
                                    {formatRubles(packInfo.packPrice)}
                                </span>{' '}
                                <span className="text-13-semibold text-success tabular-nums">
                                    {formatRubles(packInfo.discountedPackPrice)}
                                </span>
                            </p>
                            <Badge type="subtle" variant="success" size="sm">
                                −{packInfo.discountPercent}%
                            </Badge>
                        </div>
                    )}
                </div>
            )}

            {ctx.hasOrder && (
                <div className="rounded-xl bg-bg-soft/60 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-12-medium text-fg-secondary">В заказе</span>
                        <span className="text-14-semibold text-fg-primary tabular-nums">
                            {formatQty(ctx.currentQuantity)} {ctx.shortName}
                            {ctx.currentPackageCount > 0 && (
                                <span className="text-fg-secondary"> + {ctx.currentPackageCount} упак.</span>
                            )}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-soft pt-2">
                        <span className="text-12-medium text-fg-secondary">Итого</span>
                        <span className="text-20-semibold text-primary tabular-nums">{formatRubles(ctx.total)}</span>
                    </div>
                    {ctx.fullPacks > 0 && (
                        <p className="mt-1.5 flex items-center gap-1 text-12-medium text-success">
                            <Percent className="size-3 shrink-0" />
                            Скидка за {ctx.fullPacks} {pluralPacks(ctx.fullPacks)} применена
                        </p>
                    )}
                </div>
            )}

            {soldOutNoOrder ? (
                <Button variant="secondary" className="h-11 w-full rounded-xl" disabled>
                    <Package className="size-4" />
                    Разобрано
                </Button>
            ) : orderingClosedNoOrder ? (
                <Button variant="secondary" className="h-11 w-full rounded-xl" disabled>
                    <Ban className="size-4" />
                    Приём заказов завершён
                </Button>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="hidden items-stretch gap-2 lg:flex">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-11 shrink-0 rounded-xl"
                            onClick={ctx.handleRemove}
                            disabled={!ctx.canDecrease}
                            aria-label="Уменьшить количество"
                        >
                            <Minus className="size-4" />
                        </Button>
                        <div
                            className={cn(
                                'flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl',
                                'border border-border bg-bg-base px-2 text-14-semibold text-fg-primary tabular-nums',
                            )}
                        >
                            {formatQty(ctx.currentQuantity)} {ctx.shortName}
                        </div>
                        <Button
                            variant="brand"
                            size="icon"
                            className="size-11 shrink-0 rounded-xl"
                            onClick={ctx.handleAdd}
                            disabled={!ctx.canAdd}
                            aria-label="Увеличить количество"
                        >
                            <Plus className="size-4" />
                        </Button>
                    </div>
                    {ctx.showPackageButtons && ctx.packSize != null && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-10 min-w-0 flex-1 rounded-xl text-13-medium"
                                onClick={ctx.handleRemovePackage}
                                disabled={ctx.currentPackageCount <= 0 || ctx.isPending}
                            >
                                − 1 упак.
                            </Button>
                            <Button
                                variant="outline"
                                className="h-10 min-w-0 flex-1 rounded-xl text-13-medium"
                                onClick={ctx.handleAddPackage}
                                disabled={!ctx.canAddPackage || ctx.isPending}
                            >
                                + 1 упак. ({formatQty(ctx.packSize)} {ctx.shortName})
                            </Button>
                        </div>
                    )}
                    {minHint && <p className="text-center text-12-regular text-fg-tertiary">{minHint}</p>}
                </div>
            )}
        </div>
    );
}

function MobileOrderBar({ ctx }: { ctx: ItemOrderControls }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-card/95 backdrop-blur lg:hidden">
            <div
                className={cn(
                    'mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-2.5',
                    'pb-[calc(0.625rem+env(safe-area-inset-bottom))]',
                )}
            >
                <div className="min-w-0 flex-1">
                    <p className="text-11-medium uppercase tracking-wide text-fg-tertiary">
                        {ctx.hasOrder ? 'В корзине' : `Цена за ${ctx.shortName}`}
                    </p>
                    <p className="truncate text-16-semibold tabular-nums text-fg-primary">
                        {ctx.hasOrder
                            ? formatRubles(ctx.total)
                            : `${formatRubles(ctx.unitPriceRub ?? ctx.price)} / ${ctx.shortName}`}
                    </p>
                </div>
                {ctx.hasOrder ? (
                    <div className="flex shrink-0 items-stretch gap-1.5">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-10 rounded-xl"
                            onClick={ctx.handleRemove}
                            disabled={!ctx.canDecrease}
                            aria-label="Уменьшить количество"
                        >
                            <Minus className="size-4" />
                        </Button>
                        <div
                            className={cn(
                                'flex h-10 min-w-20 items-center justify-center rounded-xl',
                                'border border-border bg-bg-base px-2 text-13-semibold text-fg-primary tabular-nums',
                            )}
                        >
                            {formatQty(ctx.currentQuantity)} {ctx.shortName}
                        </div>
                        <Button
                            variant="brand"
                            size="icon"
                            className="size-10 rounded-xl"
                            onClick={ctx.handleAdd}
                            disabled={!ctx.canAdd}
                            aria-label="Увеличить количество"
                        >
                            <Plus className="size-4" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="brand"
                        className="h-10 shrink-0 rounded-xl px-5"
                        onClick={ctx.handleAdd}
                        disabled={!ctx.canAdd || ctx.isPending}
                    >
                        <Plus className="size-4" />
                        Добавить
                    </Button>
                )}
            </div>
        </div>
    );
}
