'use client';

import { use, useState } from 'react';
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
    formatMinPackageOrderHint,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getPackDiscountPricingInfo,
    isValidOrderQuantity,
    snapOrderQuantity,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { PackDiscountHint } from '../../../../components/pack-discount-hint';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';

export default function ItemDetailPage({
    params,
}: {
    params: Promise<{ id: string; itemId: string }>;
}) {
    const { id: purchaseIdStr, itemId: itemIdStr } = use(params);
    const purchaseId = Number(purchaseIdStr);
    const purchaseItemId = Number(itemIdStr);
    const utils = trpc.useUtils();

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { data: pricingSettings } = trpc.appSettings.getPricing.useQuery();
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery();
    const packDiscountPercent =
        pricingSettings?.beadPackPriceDiscountPercent ?? DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;

    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);
    const existingOrder = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
    const currentQty = existingOrder ? Number(existingOrder.quantity) : 0;

    const product = item?.product as
        (ProductLabelSource & {
            pricePerUnit: string | number;
            description?: string | null;
            supplierPackageAmount?: string | number | null;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: string | number | null;
            unit: { shortName: string; multiplicity: string | number } | null;
            minPackageAmount: string | number | null;
            minPackageUnit: string | null;
            photos: { id: number }[];
        }) | undefined;

    const unit = product?.unit;
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const packSize = product?.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;
    const minPackageAmount = product?.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product?.minPackageUnit ?? null;
    const price = item ? Number(item.priceOverride ?? product?.pricePerUnit ?? 0) : 0;

    const orderQtyOptions = {
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item?.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
    };
    const orderStep = getOrderQuantityStep(orderQtyOptions);
    const minOrderQty = getMinOrderQuantity(orderQtyOptions);

    const [quantity, setQuantity] = useState(currentQty);
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

    const upsertMutation = trpc.orders.upsertOrder.useMutation({
        onSuccess: () => {
            utils.orders.getMyOrders.invalidate();
            utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    function snap(qty: number) {
        return snapOrderQuantity(qty, orderQtyOptions);
    }

    function submit(qty: number) {
        if (qty <= 0 || qty < minOrderQty) {
            if (existingOrder) {
                const deleteMut = trpc.orders.deleteOrder.useMutation();
                deleteMut.mutate(
                    { id: existingOrder.id },
                    {
                        onSuccess: () => {
                            utils.orders.getMyOrders.invalidate();
                            utils.purchases.getById.invalidate({ id: purchaseId });
                        },
                    },
                );
            }
            return;
        }
        if (!isValidOrderQuantity(qty, orderQtyOptions)) return;
        setIsFlying(true);
        upsertMutation.mutate(
            { purchaseItemId, quantity: qty },
            { onSettled: () => setTimeout(() => setIsFlying(false), 400) },
        );
    }

    function handleAdd(step: number) {
        const next = snap(quantity + step);
        setQuantity(next);
        submit(next);
    }

    function handleRemove(step: number) {
        const next = quantity - step;
        if (next < minOrderQty) {
            setQuantity(0);
            if (existingOrder) {
                const deleteMut = trpc.orders.deleteOrder.useMutation();
                deleteMut.mutate(
                    { id: existingOrder.id },
                    {
                        onSuccess: () => {
                            utils.orders.getMyOrders.invalidate();
                            utils.purchases.getById.invalidate({ id: purchaseId });
                        },
                        onError: (err) => toast.error(err.message),
                    },
                );
            }
            return;
        }
        const snapped = snap(next);
        setQuantity(snapped);
        submit(snapped);
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
                    const hint = formatMinPackageOrderHint({
                        minPackageAmount,
                        minPackageUnit,
                        unitShort: shortName,
                    });
                    return hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null;
                })()}
                <PackDiscountHint product={product} discountPercent={packDiscountPercent} className="mt-2" />
            </div>

            {/* Photo + Info */}
            <div className="flex flex-col gap-6 md:flex-row">
                {/* Photo */}
                <div className="relative h-72 w-full shrink-0 overflow-hidden rounded-xl bg-muted md:h-96 md:w-96">
                    {product.photos?.[0] ? (
                        <img
                            src={absoluteProductPhotoUrl(product.photos[0].id)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                    )}
                    {isFlying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="animate-bounce rounded-full bg-primary p-3 text-primary-foreground shadow-lg">
                                <ShoppingCart className="h-6 w-6" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                    {/* Characteristics table */}
                    {(() => {
                        const rows: { label: string; value: string }[] = [];

                        // Brand
                        if ((product as any).brand?.name) {
                            rows.push({ label: 'Производитель', value: (product as any).brand.name });
                        }

                        // Attribute values
                        const attrValues = (product as any).attributeValues as
                            { attribute: { name: string; type: { name: string }; isBrand?: boolean } }[] | undefined;
                        if (attrValues) {
                            for (const av of attrValues) {
                                if (av.attribute.isBrand) continue;
                                const typeName = av.attribute.type?.name;
                                if (typeName && typeName !== 'Производитель') {
                                    rows.push({ label: typeName, value: av.attribute.name });
                                }
                            }
                        }

                        // Characteristic values
                        const charValues = (product as any).characteristicValues as
                            { value: string; characteristic: { name: string } }[] | undefined;
                        if (charValues) {
                            for (const cv of charValues) {
                                if (cv.characteristic?.name && cv.value) {
                                    rows.push({ label: cv.characteristic.name, value: cv.value });
                                }
                            }
                        }

                        // Unit / pricing info
                        if (product.unit?.name) {
                            const unitLabel = product.unit.shortName
                                ? `${product.unit.name} (${product.unit.shortName})`
                                : product.unit.name;
                            rows.push({ label: 'Единица', value: unitLabel });
                        }

                        if (product.minPackageAmount != null && product.minPackageUnit) {
                            rows.push({ label: 'Мин. фасовка', value: `${Number(product.minPackageAmount)} ${product.minPackageUnit}` });
                        }

                        if (rows.length === 0) return null;

                        return (
                            <div className="text-sm">
                                {rows.map((row) => (
                                    <div key={row.label} className="flex border-b border-border/50 py-1.5 last:border-0">
                                        <span className="w-36 shrink-0 text-muted-foreground">{row.label}</span>
                                        <span className="font-medium">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    <div>
                        <span className="text-3xl font-bold text-primary">{price.toLocaleString('ru-RU')} ₽</span>
                        <span className="text-lg text-muted-foreground">/{shortName}</span>
                    </div>

                    {packDiscountInfo != null && (
                        <p className="text-sm text-muted-foreground">
                            Целая пачка {packDiscountInfo.packSize} {shortName} —{' '}
                            {packDiscountInfo.discountedPackPrice.toLocaleString('ru-RU')} ₽ (скидка{' '}
                            {packDiscountInfo.discountPercent}%)
                        </p>
                    )}

                    {/* Quantity & controls */}
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            {/* Current quantity */}
                            <div className="text-center">
                                <span className="text-4xl font-bold tabular-nums">
                                    {quantity % 1 === 0 ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '')}
                                </span>
                                <span className="ml-2 text-lg text-muted-foreground">{shortName}</span>
                                {quantity > 0 && (
                                    <p className="mt-1 text-lg font-semibold">
                                        {total.toLocaleString('ru-RU')} ₽
                                    </p>
                                )}
                                {packDiscountInfo != null && fullPacks > 0 && (
                                    <p className="text-xs text-success">
                                        Скидка за {fullPacks} {fullPacks === 1 ? 'целую пачку' : 'целые пачки'}
                                    </p>
                                )}
                            </div>

                            {/* Min package buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    disabled={upsertMutation.isPending || quantity <= 0}
                                    onClick={() => handleRemove(orderStep)}
                                >
                                    <Minus className="mr-1 h-4 w-4" />
                                    {orderStep} {shortName}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => handleAdd(orderStep)}
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    {orderStep} {shortName}
                                </Button>
                            </div>

                            {/* Pack buttons */}
                            {packSize != null && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={upsertMutation.isPending || quantity < packSize}
                                        onClick={() => handleRemove(packSize)}
                                    >
                                        −Пачка ({packSize} {shortName})
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        disabled={upsertMutation.isPending}
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
    );
}
