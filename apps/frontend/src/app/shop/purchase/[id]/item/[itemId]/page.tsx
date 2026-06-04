'use client';

import { use, useEffect, useState } from 'react';
import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react';
import {
    DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT,
    PURCHASE_FULFILLMENT_LABELS,
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageHint,
    formatSupplementCardPreviewHint,
    formatSupplementPhotoRemainderBadge,
    getPackDiscountPricingInfo,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { buildShopOrderQuantityContext } from '@/app/shop/lib/order-quantity';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { ProductPricePanel } from '@/app/shop/components/product-price-panel';
import { toast } from 'sonner';
import {
    buildShopItemDescriptionRows,
    type ProductCatalogCardSource,
    type ProductLabelSource,
} from '@/app/(admin)/products/lib';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
    const { id: purchaseIdStr, itemId: itemIdStr } = use(params);
    const purchaseId = Number(purchaseIdStr);
    const purchaseItemId = Number(itemIdStr);
    const utils = trpc.useUtils();

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: pricingSettings } = trpc.appSettings.getPricing.useQuery();
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const packDiscountPercent =
        pricingSettings?.beadPackPriceDiscountPercent ?? DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;

    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);
    const existingOrder = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
    const currentQty = existingOrder ? Number(existingOrder.quantity) : 0;
    const existingPacksAdded = existingOrder?.supplementPacksAdded ?? 0;

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

    const unit = product?.unit;
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const packSize = product?.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;
    const minPackageAmount = product?.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product?.minPackageUnit ?? null;
    const isSupplement = purchase?.status === 'SUPPLEMENT' || purchase?.fulfillmentStatus === 'REORDER';

    const orderQtyOptions = {
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item?.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
    };

    const [quantity, setQuantity] = useState(0);
    const [isFlying, setIsFlying] = useState(false);

    const pricingOptions = product
        ? {
              priceTiers: product.priceTiers,
              pricePerUnit: Number(product.pricePerUnit),
              priceOverride: item?.priceOverride != null ? Number(item.priceOverride) : null,
              supplierPackageAmount: product.supplierPackageAmount,
              supplierPackageUnit: product.supplierPackageUnit,
              supplierPackagePrice: product.supplierPackagePrice,
              packDiscountPercent,
          }
        : null;

    const total = pricingOptions ? calculateOrderAmount(quantity, pricingOptions) : 0;
    const packDiscountInfo = product ? getPackDiscountPricingInfo(product, packDiscountPercent) : null;
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(quantity, packDiscountInfo.packSize) : 0;

    const deleteMutation = trpc.orders.deleteOrder.useMutation({
        onSuccess: () => {
            setQuantity(0);
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const upsertMutation = trpc.orders.upsertOrder.useMutation({
        onSuccess: (_data, variables) => {
            setQuantity(variables.quantity);
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    useEffect(() => {
        setQuantity(currentQty);
    }, [currentQty, purchaseItemId]);

    const qtyCtx = buildShopOrderQuantityContext({
        isSupplement: Boolean(isSupplement),
        fulfillmentStatus: purchase?.fulfillmentStatus,
        orderQtyOptions,
        currentQuantity: currentQty,
        availableQty: item?.availableQty,
        packSize,
        orderLines: (item as { orderLines?: { quantity: unknown }[] } | undefined)?.orderLines,
        supplementPacksAdded: existingPacksAdded,
    });
    const {
        uiStep,
        effectiveMinQty,
        snap,
        isValid,
        supplementBounds,
        supplementOnlyPacks,
        supplementPacksAllowed,
        canRemoveStep,
        canRemovePack,
        packProtection,
    } = qtyCtx;

    const orderBusy = upsertMutation.isPending || deleteMutation.isPending;

    function submit(qty: number) {
        if (qty < effectiveMinQty) {
            if (existingOrder) {
                deleteMutation.mutate({ id: existingOrder.id });
            } else {
                setQuantity(0);
            }
            return;
        }
        if (!isValid(qty)) return;
        setQuantity(qty);
        setIsFlying(true);
        upsertMutation.mutate(
            { purchaseItemId, quantity: qty },
            { onSettled: () => setTimeout(() => setIsFlying(false), 400) },
        );
    }

    function handleAdd(step: number) {
        if (orderBusy) return;
        submit(snap(quantity + step));
    }

    function handleRemove(step: number) {
        if (orderBusy) return;
        const next = quantity - step;
        if (next < effectiveMinQty) {
            if (existingOrder) {
                deleteMutation.mutate({ id: existingOrder.id });
            } else {
                setQuantity(0);
            }
            return;
        }
        submit(snap(next));
    }

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

    const fulfillmentStatus = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];

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
                        unitShort: shortName,
                    });
                    const isItemSoldOut = item.availableQty != null && Number(item.availableQty) <= 0;
                    const supplementHint =
                        isSupplement && supplementBounds
                            ? formatSupplementCardPreviewHint(supplementBounds, orderQtyOptions, {
                                  soldOut: isItemSoldOut && quantity <= 0,
                              })
                            : null;
                    if (!catalogMinHint && !supplementHint) return null;
                    return (
                        <div className="mt-1 space-y-0.5">
                            {catalogMinHint ? <p className="text-sm text-muted-foreground">{catalogMinHint}</p> : null}
                            {supplementHint ? <p className="text-sm text-warning">{supplementHint}</p> : null}
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
                            className="size-full"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                    )}
                    {isSupplement &&
                        supplementBounds &&
                        (() => {
                            const remainderBadge = formatSupplementPhotoRemainderBadge(
                                supplementBounds,
                                orderQtyOptions,
                            );
                            if (!remainderBadge) return null;
                            return (
                                <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[1]">
                                    <div className="rounded-md bg-warning-50 px-2 py-1 text-center text-xs font-semibold text-warning shadow-sm">
                                        {remainderBadge}
                                    </div>
                                </div>
                            );
                        })()}
                    {isFlying && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                            <div className="animate-bounce rounded-full bg-primary p-3 text-primary-foreground shadow-lg">
                                <ShoppingCart className="h-6 w-6" />
                            </div>
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

                    {/* Price & order — справа от описания */}
                    <div className="w-full shrink-0 space-y-4 md:min-w-[22rem] md:w-96 md:pr-8 lg:min-w-[26rem] lg:w-[28rem] lg:pr-10 xl:w-[32rem] xl:pr-12">
                        <ProductPricePanel
                            product={product}
                            priceOverride={item.priceOverride}
                            unitShort={shortName}
                            packDiscountPercent={packDiscountPercent}
                        />

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                {/* Current quantity */}
                                <div className="text-center">
                                    <span className="text-4xl font-bold tabular-nums">
                                        {quantity % 1 === 0 ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '')}
                                    </span>
                                    <span className="ml-2 text-lg text-muted-foreground">{shortName}</span>
                                    <p
                                        className={`mt-1 min-h-7 text-lg font-semibold tabular-nums ${
                                            quantity > 0 ? 'text-foreground' : 'text-transparent'
                                        }`}
                                        aria-hidden={quantity <= 0}
                                    >
                                        {total.toLocaleString('ru-RU')} ₽
                                    </p>
                                    {packDiscountInfo != null && (
                                        <p
                                            className={`min-h-4 text-xs ${
                                                fullPacks > 0 ? 'text-success' : 'text-transparent'
                                            }`}
                                            aria-hidden={fullPacks <= 0}
                                        >
                                            {fullPacks > 0
                                                ? `Скидка за ${fullPacks} ${fullPacks === 1 ? 'целую пачку' : 'целые пачки'}`
                                                : '\u00a0'}
                                        </p>
                                    )}
                                </div>

                                {isSupplement && packProtection && packProtection.supplementPacksAdded > 0 && (
                                    <div className="rounded-lg bg-warning-50 p-2.5 text-center text-sm text-warning">
                                        Защищённые пачки: {packProtection.supplementPacksAdded} x{' '}
                                        {packProtection.packSize} {shortName} (убрать только целиком)
                                    </div>
                                )}

                                {/* Min package buttons */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={orderBusy || quantity <= 0 || (isSupplement && !canRemoveStep)}
                                        onClick={() => handleRemove(uiStep)}
                                    >
                                        <Minus className="mr-1 h-4 w-4" />
                                        {uiStep} {shortName}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={orderBusy || supplementOnlyPacks}
                                        onClick={() => handleAdd(uiStep)}
                                    >
                                        <Plus className="mr-1 h-4 w-4" />
                                        {uiStep} {shortName}
                                    </Button>
                                </div>

                                {/* Pack buttons */}
                                {packSize != null && supplementPacksAllowed && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            disabled={
                                                orderBusy || (isSupplement ? !canRemovePack : quantity < packSize)
                                            }
                                            onClick={() => handleRemove(packSize)}
                                        >
                                            −Пачка ({packSize} {shortName})
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            disabled={orderBusy}
                                            onClick={() => handleAdd(packSize)}
                                        >
                                            +Пачка ({packSize} {shortName})
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
