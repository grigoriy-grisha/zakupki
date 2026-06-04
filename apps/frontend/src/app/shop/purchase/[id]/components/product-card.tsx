'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import {
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageHint,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getPackDiscountPricingInfo,
    isValidOrderQuantity,
    snapOrderQuantity,
} from '@zakupki/types';
import { ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShopPurchaseItemProductCardProps {
    item: {
        id: number;
        purchaseItemId?: number;
        priceOverride: string | null;
        availableQty: string | number | null;
        minQty: string | number | null;
        product: ProductLabelSource & {
            pricePerUnit: string | number;
            supplierPackageAmount?: string | number | null;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: string | number | null;
            unit: { shortName: string; multiplicity: string | number } | null;
            minPackageAmount: string | number | null;
            minPackageUnit: string | null;
            photos: { id: number }[];
        };
    };
    purchaseId: number;
    packDiscountPercent: number;
    currentQuantity?: number;
    isSupplement: boolean;
    onOrderChange?: () => void;
}

export function ProductCard({
    item,
    purchaseId,
    packDiscountPercent,
    currentQuantity = 0,
    isSupplement,
    onOrderChange,
}: ShopPurchaseItemProductCardProps) {
    const utils = trpc.useUtils();
    const purchaseItemId = item.purchaseItemId ?? item.id;
    const product = item.product;
    const unit = product.unit;
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const price = Number(item.priceOverride ?? product.pricePerUnit);

    const minPackageAmount = product.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product.minPackageUnit ?? null;
    const packSize = product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;

    const orderQtyOptions = {
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
    };
    const orderStep = getOrderQuantityStep(orderQtyOptions);
    const minOrderQty = getMinOrderQuantity(orderQtyOptions);

    const [quantity, setQuantity] = useState(currentQuantity);
    const [isFlying, setIsFlying] = useState(false);

    useEffect(() => {
        setQuantity(currentQuantity);
    }, [currentQuantity]);

    const isSoldOut = item.availableQty !== null && item.availableQty !== undefined && Number(item.availableQty) <= 0;
    const hasOrder = currentQuantity > 0;
    const photo = product.photos?.[0];

    const upsertMutation = trpc.orders.upsertOrder.useMutation({
        onSuccess: () => {
            utils.orders.getMyOrders.invalidate();
            utils.purchases.getById.invalidate({ id: purchaseId });
            onOrderChange?.();
        },
        onError: (err) => toast.error(err.message),
    });

    const pricingOptions = {
        priceTiers: product.priceTiers,
        pricePerUnit: Number(product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        supplierPackageAmount: product.supplierPackageAmount,
        supplierPackageUnit: product.supplierPackageUnit,
        supplierPackagePrice: product.supplierPackagePrice,
        packDiscountPercent,
    };

    const total = calculateOrderAmount(quantity, pricingOptions);
    const packDiscountInfo = getPackDiscountPricingInfo(product, packDiscountPercent);
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(quantity, packDiscountInfo.packSize) : 0;

    function snap(qty: number) {
        return snapOrderQuantity(qty, orderQtyOptions);
    }

    function submit(qty: number) {
        if (qty < minOrderQty) {
            // delete the order instead
            if (hasOrder) {
                // Find the order line and delete it
                const myOrders = utils.orders.getMyOrders.getData();
                const line = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
                if (line) {
                    trpc.orders.deleteOrder.useMutation().mutate(
                        { id: line.id },
                        {
                            onSuccess: () => {
                                utils.orders.getMyOrders.invalidate();
                                utils.purchases.getById.invalidate({ id: purchaseId });
                                onOrderChange?.();
                            },
                        },
                    );
                }
            }
            return;
        }
        if (!isValidOrderQuantity(qty, orderQtyOptions)) return;
        setIsFlying(true);
        upsertMutation.mutate(
            { purchaseItemId, quantity: qty },
            {
                onSettled: () => setTimeout(() => setIsFlying(false), 400),
            },
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
            // delete
            const myOrders = utils.orders.getMyOrders.getData();
            const line = myOrders?.find((o: any) => o.purchaseItemId === purchaseItemId);
            if (line) {
                const deleteMut = trpc.orders.deleteOrder.useMutation();
                deleteMut.mutate(
                    { id: line.id },
                    {
                        onSuccess: () => {
                            utils.orders.getMyOrders.invalidate();
                            utils.purchases.getById.invalidate({ id: purchaseId });
                            onOrderChange?.();
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

    return (
        <Card
            className={cn(
                'group relative flex h-full flex-col gap-0 overflow-hidden rounded-lg border py-0 transition-all',
                isSoldOut && !hasOrder && 'opacity-60 border-transparent',
                hasOrder && 'border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]',
                !hasOrder && 'border-transparent',
                !isSoldOut && 'hover:shadow-md',
            )}
            onClick={() => {
                // Navigate to detail page
                window.location.href = `/shop/purchase/${purchaseId}/item/${purchaseItemId}`;
            }}
            role="link"
            style={{ cursor: 'pointer' }}
        >
            {/* Flying animation */}
            {isFlying && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <div className="animate-bounce rounded-full bg-primary p-2 text-primary-foreground shadow-lg">
                        <ShoppingCart className="h-5 w-5" />
                    </div>
                </div>
            )}

            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <ProductPhotoPreview photoId={photo?.id} alt={product.name} fill />
                {hasOrder && !isSoldOut && (
                    <>
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1] rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
                            В корзине
                        </div>
                        <div className="pointer-events-none absolute top-1.5 right-1.5 z-[1] flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-primary-foreground shadow-sm">
                            <span className="text-[11px] font-bold leading-none tabular-nums">{quantity}</span>
                        </div>
                    </>
                )}
                {isSupplement && (
                    <Badge
                        className={cn(
                            'pointer-events-none absolute bottom-1.5 left-1.5 z-[1] max-w-[calc(100%-0.75rem)] truncate px-1.5 py-0 text-[10px]',
                            isSoldOut ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning',
                        )}
                    >
                        {item.availableQty == null
                            ? packSize != null
                                ? `Пачка: ${packSize} ${shortName}`
                                : 'Добор'
                            : isSoldOut
                                ? 'Разобрано'
                                : packSize != null
                                    ? `Остаток: ${Number(item.availableQty)} ${shortName}`
                                    : `Доступно: ${Number(item.availableQty)} ${shortName}`}
                    </Badge>
                )}
            </div>

            <CardContent className="flex flex-1 flex-col p-3">
                <div className="min-h-0 flex-1">
                    <PurchaseProductLabel
                        product={product}
                        className="min-w-0 overflow-hidden"
                        primaryClassName="block truncate text-sm font-semibold leading-snug"
                        secondaryClassName="block truncate text-xs text-muted-foreground"
                    />
                    {(() => {
                        const hint = formatMinPackageHint({
                            minPackageAmount,
                            minPackageUnit,
                            unitShort: shortName,
                        });
                        return hint ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
                        ) : null;
                    })()}
                    <div className="mt-2">
                        <span className="text-lg font-bold text-primary">{price.toLocaleString('ru-RU')} ₽</span>
                        <span className="text-sm text-muted-foreground">/{shortName}</span>
                    </div>
                </div>

                {isSoldOut && !hasOrder ? (
                    <Button className="mt-2.5 h-9 w-full shrink-0 text-xs" variant="secondary" disabled>
                        Разобрано
                    </Button>
                ) : (
                    <div className="mt-auto shrink-0 space-y-2 pt-2.5">
                        <div className="flex min-h-[2.75rem] flex-col justify-center text-center">
                            {hasOrder && (
                                <>
                                    <span className="text-sm text-muted-foreground">
                                        {quantity} {shortName} ·{' '}
                                        <span className="font-semibold text-foreground">
                                            {total.toLocaleString('ru-RU')} ₽
                                        </span>
                                    </span>
                                    {packDiscountInfo != null && fullPacks > 0 ? (
                                        <p className="text-[10px] text-success">
                                            Скидка за {fullPacks} {fullPacks === 1 ? 'пачку' : 'пачки'}
                                        </p>
                                    ) : (
                                        <span className="block text-[10px] leading-snug opacity-0" aria-hidden>
                                            —
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* - min package */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 flex-1 text-xs"
                                disabled={upsertMutation.isPending || !hasOrder}
                                onClick={() => handleRemove(orderStep)}
                            >
                                <Minus className="mr-1 h-3 w-3" />
                                {orderStep} {shortName}
                            </Button>

                            {/* + min package */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 flex-1 text-xs"
                                disabled={upsertMutation.isPending}
                                onClick={() => handleAdd(orderStep)}
                            >
                                <Plus className="mr-1 h-3 w-3" />
                                {orderStep} {shortName}
                            </Button>
                        </div>

                        {/* Pack buttons */}
                        {packSize != null && (
                            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {/* - pack */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 flex-1 text-[11px]"
                                    disabled={upsertMutation.isPending || quantity < packSize}
                                    onClick={() => handleRemove(packSize)}
                                >
                                    −Пачка ({packSize} {shortName})
                                </Button>
                                {/* + pack */}
                                <Button
                                    size="sm"
                                    className="h-9 flex-1 text-[11px]"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => handleAdd(packSize)}
                                >
                                    +Пачка ({packSize} {shortName})
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
