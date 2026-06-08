'use client';

import { use } from 'react';
import { AppLink } from '@/components/app-link';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart, Minus, Plus } from 'lucide-react';
import {
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageHint,
    getPackDiscountPricingInfo,
    getSupplementPool,
    getSupplementStep,
    buildOrderQtyOptions,
    getOrderQuantityStep,
    isSupplementPhase,
} from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { ProductPricePanel } from '@/app/shop/components/product-price-panel';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
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
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);
    const existingOrder = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
    const currentQuantity = existingOrder ? Number(existingOrder.quantity ?? 0) : 0;
    const currentPackageCount = existingOrder?.packageCount ?? 0;
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

    const unit = product?.unit;
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const packSize = product?.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;
    const minPackageAmount = product?.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product?.minPackageUnit ?? null;
    const isSupplement = isSupplementPhase(purchase?.fulfillmentStatus ?? 'COLLECTION');
    const fulfillmentStatus = purchase?.fulfillmentStatus ?? 'COLLECTION';
    const regularStep = getOrderQuantityStep(
        buildOrderQtyOptions({ multiplicity, minPackageAmount, minPackageUnit }),
    );
    const activeStep = getSupplementStep({
        fulfillmentStatus,
        supplementStep: item?.supplementStep != null ? Number(item.supplementStep) : null,
        regularStep,
    });

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: null,
        unitShort: shortName,
    });

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

    // Упаковка
    const hasSupplierPackage = packSize != null && packSize > 0;
    const packagePrice =
        product?.supplierPackagePrice != null && Number(product.supplierPackagePrice) > 0
            ? Number(product.supplierPackagePrice)
            : (product ? Number(product.pricePerUnit) : 0) * (packSize ?? 0);
    const packageTotal = currentPackageCount * packagePrice;
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';
    const showPackageButtons = canAddPackage && hasSupplierPackage;

    const total = (pricingOptions ? calculateOrderAmount(currentQuantity, pricingOptions) : 0) + packageTotal;
    const packDiscountInfo = product ? getPackDiscountPricingInfo(product, packDiscountPercent) : null;
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

    // Pool расчёт
    const activeLines = (item?.orderLines ?? []).filter((line: any) => line.status !== 'CANCELLED');
    const supplementClaimed = activeLines
        .filter((line: any) => line.userId !== (existingOrder as any)?.userId)
        .reduce((acc: number, line: any) => acc + Math.max(0, Number(line.quantity ?? 0) - Number(line.baseQuantity ?? 0)), 0);
    const totalOrderedQuantity = activeLines.reduce(
        (acc: number, line: any) => acc + Number(line.quantity ?? 0),
        0,
    );
    const totalBaseQuantity = activeLines.reduce(
        (acc: number, line: any) => acc + Number(line.baseQuantity ?? 0),
        0,
    );
    const availablePool = isSupplement
        ? getSupplementPool({
              targetRemainder: item?.targetRemainder != null ? Number(item.targetRemainder) : null,
              totalOrderedQuantity,
              supplementClaimed,
              packSize,
              totalBaseQuantity,
          })
        : null;

    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const packageMutation = trpc.orders.adjustPackageCount.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const orderBusy = adjustMutation.isPending || packageMutation.isPending;

    function handleAdd() {
        if (orderBusy) return;
        const maxAllowed = availablePool != null ? availablePool + baseQuantity : Number.POSITIVE_INFINITY;
        if (currentQuantity >= maxAllowed) return;
        const remaining = maxAllowed - currentQuantity;
        const delta = remaining < activeStep ? remaining : activeStep;
        adjustMutation.mutate({ purchaseItemId, delta });
    }

    function handleRemove() {
        if (orderBusy || currentQuantity <= 0) return;
        const minAllowed =
            fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER' ? baseQuantity : 0;
        const removableQty = currentQuantity - minAllowed;
        if (removableQty <= 0) return;
        const delta = removableQty < activeStep ? removableQty : activeStep;
        adjustMutation.mutate({ purchaseItemId, delta: -delta });
    }

    const maxAllowed = availablePool != null ? availablePool + baseQuantity : Number.POSITIVE_INFINITY;
    const canAdd = !orderBusy && currentQuantity < maxAllowed;

    const freeRemainderLabel =
        isSupplement && availablePool != null && availablePool < Number.POSITIVE_INFINITY
            ? `Доступно ещё: ${availablePool} ${shortName}`
            : null;

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
                                        {currentQuantity % 1 === 0 ? currentQuantity : currentQuantity.toFixed(3).replace(/\.?0+$/, '')}
                                    </span>
                                    <span className="ml-2 text-lg text-muted-foreground">{shortName}</span>
                                    <p
                                        className={`mt-1 min-h-7 text-lg font-semibold tabular-nums ${
                                            currentQuantity > 0 ? 'text-foreground' : 'text-transparent'
                                        }`}
                                        aria-hidden={currentQuantity <= 0}
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
                                                : ' '}
                                        </p>
                                    )}
                                </div>

                                {/* ±мин.фасовка */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={orderBusy || currentQuantity <= 0 || (fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER' && currentQuantity <= baseQuantity)}
                                        onClick={handleRemove}
                                    >
                                        <Minus className="mr-1 h-4 w-4" />
                                        −{activeStep} {shortName}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={!canAdd}
                                        onClick={handleAdd}
                                    >
                                        <Plus className="mr-1 h-4 w-4" />
                                        +{activeStep} {shortName}
                                    </Button>
                                </div>

                                {/* ±упаковка поставщика */}
                                {showPackageButtons && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            disabled={orderBusy || currentPackageCount <= 0}
                                            onClick={() => packageMutation.mutate({ purchaseItemId, delta: -1 })}
                                        >
                                            <Minus className="mr-1 h-4 w-4" />
                                            −Упаковку
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            disabled={orderBusy}
                                            onClick={() => packageMutation.mutate({ purchaseItemId, delta: 1 })}
                                        >
                                            <Plus className="mr-1 h-4 w-4" />
                                            +Упаковку ({packSize} {shortName})
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