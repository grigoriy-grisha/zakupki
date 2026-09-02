'use client';

import type { CurrencyRate } from '@zakupki/types';
import { ArrowLeft, Building2, PackageSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useMemo } from 'react';

import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { buildStepHint } from '@/app/shop/lib/format-step-hint';
import type { ShopPurchaseItem } from '@/app/shop/lib/types';
import { AppLink } from '@/components/app-link';
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
import { cn } from '@/lib/utils';

import { aggregateUserLines } from '../../../../lib/order-aggregation';
import { ItemBuyPanel } from './components/item-buy-panel';
import { ItemGallery } from './components/item-gallery';
import { MobileOrderBar } from './components/mobile-order-bar';
import { SectionCard } from './components/section-card';

interface ItemDetailProduct extends ProductLabelSource {
    photos?: { id: number }[];
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
    const { id: purchaseIdStr, itemId: itemIdStr } = use(params);
    const purchaseId = Number(purchaseIdStr);
    const purchaseItemId = Number(itemIdStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { beadPackPriceDiscountPercent: packDiscountPercent, orgFeeDefaultPercent } = usePricingSettings();

    if (isLoading || !purchase) {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 sm:gap-6">
                <Skeleton className="h-8 w-44 rounded-lg" />
                <div
                    className={cn(
                        'flex flex-col gap-5 sm:gap-6',
                        'lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6',
                        'xl:grid-cols-[minmax(0,28rem)_24rem] xl:gap-8',
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
            <div className="rounded-2xl bg-bg-soft">
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
            deliveryPercent={Number(purchase.deliveryPercent ?? 0)}
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
    deliveryPercent,
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
    deliveryPercent: number;
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
        deliveryPercent,
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
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5">
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
                    'xl:grid-cols-[minmax(0,28rem)_24rem] xl:gap-8',
                )}
            >
                <div className="max-lg:contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
                    <div className="order-2 min-w-0">
                        <ItemGallery photoIds={photoIds} alt={product.name} />
                    </div>

                    {descriptionRows.length > 0 && (
                        <div className="order-4 min-w-0">
                            <SectionCard title="Характеристики">
                                <dl className="px-4 sm:px-5">
                                    {descriptionRows.map((row, index) => (
                                        <div
                                            key={row.label}
                                            className={cn(
                                                'flex items-baseline justify-between gap-4 py-2.5',
                                                index < descriptionRows.length - 1 && 'border-b border-border-low',
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
                        </div>
                    )}
                </div>

                <div className="max-lg:contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-5">
                    <div className="order-1 min-w-0">
                        <PurchaseProductLabel
                            product={product}
                            className="min-w-0"
                            primaryClassName="block font-display text-20-bold leading-tight text-fg-primary sm:text-24-bold"
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

                    <div className="order-3 lg:sticky lg:top-20">
                        <ItemBuyPanel ctx={ctx} minHint={minHint} />
                    </div>
                </div>
            </div>

            {showMobileBar && <MobileOrderBar ctx={ctx} />}
            {showMobileBar && <div className="h-20 shrink-0 lg:hidden" aria-hidden />}
        </div>
    );
}
