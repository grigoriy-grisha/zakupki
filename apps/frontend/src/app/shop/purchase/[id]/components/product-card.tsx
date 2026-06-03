'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import {
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageOrderHint,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getPackDiscountPricingInfo,
    isValidOrderQuantity,
    snapOrderQuantity,
} from '@zakupki/types';
import { ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react';
import { PackDiscountHint } from '../../../components/pack-discount-hint';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppLink } from '@/components/app-link';

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
                'group overflow-hidden transition-all relative',
                isSoldOut && !hasOrder && 'opacity-60',
                hasOrder && 'ring-2 ring-primary/20',
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

            <div className="relative h-48 bg-muted">
                {photo ? (
                    <img
                        src={absoluteProductPhotoUrl(photo.id)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                )}
                {hasOrder && !isSoldOut && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <span className="text-xs font-bold">{quantity}</span>
                    </div>
                )}
                {isSupplement && (
                    <Badge
                        className={`absolute bottom-2 left-2 ${isSoldOut ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'}`}
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

            <CardContent className="p-4">
                <div>
                    <PurchaseProductLabel product={product} primaryClassName="font-semibold" />
                    {(() => {
                        const hint = formatMinPackageOrderHint({
                            minPackageAmount,
                            minPackageUnit,
                            unitShort: shortName,
                        });
                        return hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null;
                    })()}
                    <PackDiscountHint product={product} discountPercent={packDiscountPercent} className="mt-1.5" />
                </div>

                <div className="mt-2">
                    <span className="text-xl font-bold text-primary">{price.toLocaleString('ru-RU')} ₽</span>
                    <span className="text-sm text-muted-foreground">/{shortName}</span>
                </div>

                {isSoldOut && !hasOrder ? (
                    <Button className="mt-3 w-full" variant="secondary" disabled>
                        Разобрано
                    </Button>
                ) : (
                    <div className="mt-3 space-y-2">
                        {/* Quantity display + total */}
                        {hasOrder && (
                            <div className="text-center">
                                <span className="text-sm text-muted-foreground">
                                    {quantity} {shortName} · <span className="font-semibold text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                                </span>
                                {packDiscountInfo != null && fullPacks > 0 && (
                                    <p className="text-[11px] text-success">
                                        Скидка за {fullPacks} {fullPacks === 1 ? 'пачку' : 'пачки'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Controls */}
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* - min package */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
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
                                className="flex-1 text-xs"
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
                                    className="flex-1 text-xs"
                                    disabled={upsertMutation.isPending || quantity < packSize}
                                    onClick={() => handleRemove(packSize)}
                                >
                                    −Пачка ({packSize} {shortName})
                                </Button>
                                {/* + pack */}
                                <Button
                                    size="sm"
                                    className="flex-1 text-xs"
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
