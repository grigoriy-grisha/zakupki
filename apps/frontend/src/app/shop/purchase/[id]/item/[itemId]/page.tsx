'use client';

import { use } from 'react';
import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { formatMinPackageHint, isSupplementPhase } from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { ProductPricePanel } from '@/app/shop/components/product-price-panel';
import { QuantityButtons } from '@/app/shop/components/quantity-buttons';
import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import {
    buildShopItemDescriptionRows,
    type ProductCatalogCardSource,
    type ProductLabelSource,
} from '@/app/(admin)/products/lib';
import type { ShopPurchaseItem } from '@/app/shop/lib/types';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
    const { id: purchaseIdStr, itemId: itemIdStr } = use(params);
    const purchaseId = Number(purchaseIdStr);
    const purchaseItemId = Number(itemIdStr);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const item = purchase?.items.find((i: any) => i.id === purchaseItemId) as ShopPurchaseItem | undefined;
    const existingOrder = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
    const currentQuantity = existingOrder ? Number(existingOrder.quantity ?? 0) : 0;
    const currentPackageCount = (existingOrder as any)?.packageCount ?? 0;
    const baseQuantity = existingOrder?.baseQuantity != null ? Number(existingOrder.baseQuantity) : 0;

    const product = item?.product as
        | (ProductLabelSource & {
              pricePerUnit: string | number;
              priceTiers?: unknown;
              description?: string | null;
              supplierPackageAmount?: string | number | null;
              supplierPackageUnit?: string | null;
              supplierPackagePrice?: string | number | null;
              unit: { shortName: string; multiplicity: string | number } | null;
              minPackageAmount: string | number | null;
              minPackageUnit: string | null;
              photos: { id: number }[];
          })
        | undefined;

    const fulfillmentStatus = purchase?.fulfillmentStatus ?? 'COLLECTION';

    const ctx = useItemOrderControls({
        purchaseId,
        purchaseItemId,
        item: item!,
        currentQuantity,
        currentPackageCount,
        baseQuantity,
        fulfillmentStatus,
        packDiscountPercent,
    });

    const minPackageAmount = product?.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product?.minPackageUnit ?? null;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="flex gap-6">
                    <Skeleton className="h-64 w-64" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (!purchase || !item || !product) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center py-16">
                    <h2 className="text-lg font-medium">Товар не найден</h2>
                    <Button variant="outline" className="mt-4" asChild>
                        <AppLink href={`/shop/purchase/${purchaseId}`}>Назад к закупке</AppLink>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const isSupplement = isSupplementPhase(fulfillmentStatus);

    return (
        <div className="space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" asChild className="-ml-2">
                <AppLink href={`/shop/purchase/${purchaseId}`}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    {purchase.tag}
                </AppLink>
            </Button>

            {/* Title */}
            <div>
                <PurchaseProductLabel product={product} primaryClassName="text-2xl font-semibold" />
                {(() => {
                    const catalogMinHint = formatMinPackageHint({
                        minPackageAmount,
                        minPackageUnit,
                        unitShort: ctx.shortName,
                    });
                    const freeRemainderLabel =
                        isSupplement && ctx.availablePool != null && ctx.availablePool < Number.POSITIVE_INFINITY
                            ? `Доступно ещё: ${ctx.availablePool} ${ctx.shortName}`
                            : null;
                    if (!catalogMinHint && !freeRemainderLabel) return null;
                    return (
                        <div className="mt-1 space-y-0.5">
                            {catalogMinHint ? <p className="text-sm text-muted-foreground">{catalogMinHint}</p> : null}
                            {freeRemainderLabel ? <p className="text-sm text-warning">{freeRemainderLabel}</p> : null}
                        </div>
                    );
                })()}
            </div>

            {/* Photo + description + order */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* Photo */}
                <div className="relative h-72 w-full shrink-0 overflow-hidden rounded-xl bg-muted lg:h-96 lg:w-96">
                    {product.photos?.[0] ? (
                        <ProductPhotoPreview
                            photoId={product.photos[0].id}
                            alt={product.name}
                            fill
                            zoomSize="lg"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-6 md:flex-row md:items-start md:gap-10">
                    {/* Description */}
                    <div className="min-w-0 flex-1">
                        {(() => {
                            const rows = buildShopItemDescriptionRows(
                                product as ProductCatalogCardSource,
                                attributeTypes,
                            );
                            if (rows.length === 0) return null;
                            return (
                                <dl className="grid grid-cols-[minmax(0,11rem)_1fr] gap-x-4 gap-y-0 md:grid-cols-[minmax(0,12rem)_1fr] md:gap-x-6">
                                    {rows.map((row) => (
                                        <div key={row.label} className="contents">
                                            <dt className="border-b border-border/50 py-2.5 text-base leading-snug text-muted-foreground md:py-3">
                                                {row.label}
                                            </dt>
                                            <dd className="border-b border-border/50 py-2.5 text-lg font-medium leading-snug md:py-3">
                                                {row.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            );
                        })()}
                    </div>

                    {/* Price & order */}
                    <div className="w-full shrink-0 space-y-4 md:min-w-[22rem] md:w-96 md:pr-8 lg:min-w-[26rem] lg:w-[28rem] lg:pr-10 xl:w-[32rem] xl:pr-12">
                        <ProductPricePanel
                            product={product}
                            priceOverride={item.priceOverride}
                            unitShort={ctx.shortName}
                            packDiscountPercent={packDiscountPercent}
                        />

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                {/* Current quantity */}
                                <div className="text-center">
                                    <span className="text-4xl font-bold tabular-nums">
                                        {currentQuantity % 1 === 0 ? currentQuantity : currentQuantity.toFixed(3).replace(/\.?0+$/, '')}
                                    </span>
                                    <span className="ml-2 text-lg text-muted-foreground">{ctx.shortName}</span>
                                    <p
                                        className={`mt-1 min-h-7 text-lg font-semibold tabular-nums ${
                                            currentQuantity > 0 ? 'text-foreground' : 'text-transparent'
                                        }`}
                                        aria-hidden={currentQuantity <= 0}
                                    >
                                        {ctx.total.toLocaleString('ru-RU')} ₽
                                    </p>
                                    {ctx.fullPacks > 0 && (
                                        <p className="text-xs text-success">
                                            Скидка за {ctx.fullPacks} {ctx.fullPacks === 1 ? 'целую пачку' : 'целые пачки'}
                                        </p>
                                    )}
                                </div>

                                <QuantityButtons
                                    activeStep={ctx.activeStep}
                                    shortName={ctx.shortName}
                                    canAdd={ctx.canAdd}
                                    canDecrease={ctx.canDecrease}
                                    onAdd={ctx.handleAdd}
                                    onRemove={ctx.handleRemove}
                                    isPending={ctx.isPending}
                                    showPackage={ctx.showPackageButtons}
                                    packSize={ctx.packSize}
                                    packageCount={ctx.currentPackageCount}
                                    onAddPackage={ctx.handleAddPackage}
                                    onRemovePackage={ctx.handleRemovePackage}
                                    size="md"
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
