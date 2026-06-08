'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import {
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageHint,
    getPackDiscountPricingInfo,
    getUnitByCode,
    buildOrderQtyOptions,
    getOrderQuantityStep,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { buildShopOrderQuantityContext } from '@/app/shop/lib/order-quantity';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShopPurchaseItemProductCardProps {
    item: {
        id: number;
        purchaseItemId?: number;
        priceOverride: string | null;
        targetRemainder: string | number | null;
        minQty: string | number | null;
        /** Текущее количество этого пользователя */
        quantity: number;
        orderLines?: { quantity: unknown; userId: number; baseQuantity: unknown; status?: string | null }[];
        product: ProductLabelSource & {
            pricePerUnit: string | number;
            supplierPackageAmount?: string | number | null;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: string | number | null;
            unitCode: string;
            multiplicity: string | number;
            minPackageAmount: string | number | null;
            minPackageUnit: string | null;
            photos: { id: number }[];
        };
    };
    purchaseId: number;
    packDiscountPercent: number;
    /** baseQuantity — замороженный снимок при входе в SUPPLEMENT */
    baseQuantity?: number | null;
    isSupplement: boolean;
    onOrderChange?: () => void;
}

export function ProductCard({
    item,
    purchaseId,
    packDiscountPercent,
    baseQuantity: baseQuantityProp,
    isSupplement,
    onOrderChange,
}: ShopPurchaseItemProductCardProps) {
    const utils = trpc.useUtils();
    const purchaseItemId = item.purchaseItemId ?? item.id;
    const product = item.product;
    const unit = getUnitByCode(product.unitCode);
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = Number(product.multiplicity) || 1;
    const price = Number(item.priceOverride ?? product.pricePerUnit);

    const minPackageAmount = product.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product.minPackageUnit ?? null;
    const packSize = product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
    });

    const baseQuantity = baseQuantityProp ?? 0;
    const currentQuantity = item.quantity ?? 0;
    const minPackaging = getOrderQuantityStep(orderQtyOptions);

    // Только ACTIVE строки (исключаем CANCELLED)
    const activeLines = (item.orderLines ?? []).filter((line) => line.status !== 'CANCELLED');
    // Сумма baseQuantity ДРУГИХ пользователей (для pool расчёта)
    const sumOtherBaseQuantities = activeLines.reduce(
        (acc, line) => acc + Number(line.baseQuantity ?? 0),
        0,
    );
    const totalOrderedQuantity = activeLines.reduce(
        (acc, line) => acc + Number(line.quantity ?? 0),
        0,
    );

    const qtyCtx = buildShopOrderQuantityContext({
        isSupplement,
        baseQuantity,
        currentQuantity,
        availableRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        packSize,
        sumOtherRemainders: sumOtherBaseQuantities,
        totalOrderedQuantity,
        orderQtyOptions,
    });

    const hasOrder = currentQuantity > 0;
    const photo = product.photos?.[0];

    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
            onOrderChange?.();
        },
        onError: (err) => toast.error(err.message),
    });

    const orderBusy = adjustMutation.isPending;

    const pricingOptions = {
        priceTiers: (product as { priceTiers?: unknown }).priceTiers,
        pricePerUnit: Number(product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        supplierPackageAmount: product.supplierPackageAmount,
        supplierPackageUnit: product.supplierPackageUnit,
        supplierPackagePrice: product.supplierPackagePrice,
        packDiscountPercent,
    };
    const total = calculateOrderAmount(currentQuantity, pricingOptions);
    const packDiscountInfo = getPackDiscountPricingInfo(product, packDiscountPercent);
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

    // Available pool info
    const availablePool = qtyCtx.availablePool;
    const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
    const isSoldOut = poolExhausted && !hasOrder;

    function handleAdd() {
        if (orderBusy || (availablePool != null && currentQuantity + minPackaging > availablePool + baseQuantity)) return;
        adjustMutation.mutate({ purchaseItemId, delta: minPackaging });
    }

    function handleRemove() {
        if (orderBusy || currentQuantity <= 0) return;
        if (currentQuantity <= minPackaging) {
            // Remove order completely
            adjustMutation.mutate({ purchaseItemId, delta: -currentQuantity });
        } else {
            adjustMutation.mutate({ purchaseItemId, delta: -minPackaging });
        }
    }

    const canAdd = !orderBusy && (availablePool == null || currentQuantity + minPackaging <= availablePool + baseQuantity);

    const freeRemainderLabel =
        isSupplement && availablePool != null && availablePool < Number.POSITIVE_INFINITY
            ? `Можно докинуть: ${availablePool} ${shortName}`
            : null;

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
                window.location.href = `/shop/purchase/${purchaseId}/item/${purchaseItemId}`;
            }}
            role="link"
            style={{ cursor: 'pointer' }}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <ProductPhotoPreview photoId={photo?.id} alt={product.name} fill />
                {hasOrder && !isSoldOut && (
                    <>
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1] rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
                            В корзине
                        </div>
                        <div className="pointer-events-none absolute top-1.5 right-1.5 z-[1] flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-primary-foreground shadow-sm">
                            <span className="text-[11px] font-bold leading-none tabular-nums">
                                {currentQuantity}
                            </span>
                        </div>
                    </>
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
                        const catalogMinHint = formatMinPackageHint({
                            minPackageAmount,
                            minPackageUnit,
                            unitShort: shortName,
                        });
                        if (!catalogMinHint && !freeRemainderLabel) return null;
                        return (
                            <div className="mt-0.5 space-y-0.5">
                                {catalogMinHint ? (
                                    <p className="truncate text-xs text-muted-foreground">{catalogMinHint}</p>
                                ) : null}
                                {freeRemainderLabel ? (
                                    <p className="truncate text-xs font-medium text-warning">
                                        {freeRemainderLabel}
                                    </p>
                                ) : null}
                            </div>
                        );
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
                                        {currentQuantity} {shortName} ·{' '}
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

                        {/* ±мин.фасовка */}
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 flex-1 text-xs"
                                disabled={orderBusy || currentQuantity <= 0}
                                onClick={handleRemove}
                            >
                                <Minus className="mr-1 h-3 w-3" />
                                −{minPackaging} {shortName}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 flex-1 text-xs"
                                disabled={!canAdd}
                                onClick={handleAdd}
                            >
                                <Plus className="mr-1 h-3 w-3" />
                                +{minPackaging} {shortName}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}