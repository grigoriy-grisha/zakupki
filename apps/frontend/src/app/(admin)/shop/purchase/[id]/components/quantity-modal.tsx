'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    calculateFreeRemainder,
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageOrderHint,
    formatSupplementOrderHint,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getPackDiscountPricingInfo,
    getSupplementDisplayMax,
    isValidOrderQuantity,
    isValidSupplementOrderQuantity,
    snapOrderQuantity,
    snapSupplementOrderQuantity,
} from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuantityModalProps {
    purchaseItemId: number;
    purchaseId: number;
    packDiscountPercent: number;
    currentQuantity?: number;
    isSupplementMode?: boolean;
    onClose: () => void;
}

export function QuantityModal({
    purchaseItemId,
    purchaseId,
    packDiscountPercent,
    currentQuantity,
    isSupplementMode: isSupplementModeProp,
    onClose,
}: QuantityModalProps) {
    const utils = trpc.useUtils();

    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);

    const unit = item?.product?.unit;
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const minPackageAmount =
        item?.product?.minPackageAmount != null ? Number(item.product.minPackageAmount) : null;
    const minPackageUnit = item?.product?.minPackageUnit ?? null;
    const orderQtyOptions = {
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item?.minQty != null ? Number(item.minQty) : null,
        unitShort: unit?.shortName ?? 'ед.',
    };
    const orderStep = getOrderQuantityStep(orderQtyOptions);
    const minOrderQty = getMinOrderQuantity(orderQtyOptions);
    const rawAvailableQty =
        item?.availableQty !== null && item?.availableQty !== undefined ? Number(item.availableQty) : null;
    const currentQty = currentQuantity ?? 0;
    const isSupplementMode = isSupplementModeProp ?? purchase?.status === 'SUPPLEMENT';

    // Рассчитываем свободный остаток из пачек как fallback для availableQty
    const packSize =
        item?.product?.supplierPackageAmount != null ? Number(item.product.supplierPackageAmount) : null;
    const freeRemainderFromPacks = calculateFreeRemainder(item?.orderLines ?? [], packSize);

    const effectiveAvailableQty = rawAvailableQty != null ? rawAvailableQty : freeRemainderFromPacks;

    const supplementBounds = isSupplementMode
        ? {
              availableQty: effectiveAvailableQty,
              currentQuantity: currentQty,
              supplierPackageAmount: packSize,
          }
        : null;

    const maxQty = supplementBounds ? getSupplementDisplayMax(supplementBounds) : null;

    const startQty =
        currentQuantity != null
            ? Math.max(currentQuantity, minOrderQty)
            : minOrderQty;
    const effectiveStart = supplementBounds
        ? snapSupplementOrderQuantity(startQty, orderQtyOptions, supplementBounds)
        : snapOrderQuantity(startQty, orderQtyOptions);

    const [quantity, setQuantity] = useState(currentQuantity ?? effectiveStart);

    useEffect(() => {
        if (currentQuantity != null || !item || !unit) return;
        setQuantity(effectiveStart);
    }, [currentQuantity, effectiveStart, item, unit]);

    const upsertMutation = trpc.orders.upsertOrder.useMutation({
        onSuccess: () => {
            utils.orders.getMyOrders.invalidate();
            utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Заказ добавлен');
            onClose();
        },
        onError: (err) => toast.error(err.message),
    });

    if (!item || !unit) return null;

    const product = item.product as {
        name: string;
        pricePerUnit: unknown;
        priceTiers?: unknown;
        minPackageAmount?: unknown;
        minPackageUnit?: string | null;
        supplierPackageAmount?: unknown;
        supplierPackageUnit?: string | null;
        supplierPackagePrice?: unknown;
    };

    const shortName = unit.shortName;
    const unitPrice = Number(item.priceOverride ?? product.pricePerUnit);
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
    const fullPacks =
        packDiscountInfo != null ? countFullSupplierPacks(quantity, packDiscountInfo.packSize) : 0;

    const remainingLabel = maxQty != null ? Math.max(0, maxQty - quantity) : null;

    const quantityValid = supplementBounds
        ? isValidSupplementOrderQuantity(quantity, orderQtyOptions, supplementBounds)
        : isValidOrderQuantity(quantity, orderQtyOptions);

    function handleQuantityChange(delta: number) {
        setQuantity((prev) => {
            const next = Number((prev + delta).toFixed(3));
            if (supplementBounds) {
                return snapSupplementOrderQuantity(next, orderQtyOptions, supplementBounds);
            }
            return snapOrderQuantity(next, orderQtyOptions);
        });
    }

    function handleSubmit() {
        upsertMutation.mutate({ purchaseItemId, quantity });
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="pr-6 text-left">
                        <PurchaseProductLabel product={item.product} primaryClassName="text-lg font-semibold" />
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {isSupplementMode && supplementBounds ? (
                            formatSupplementOrderHint(supplementBounds, orderQtyOptions)
                        ) : (
                            <>
                                {formatMinPackageOrderHint(orderQtyOptions) ??
                                    `${unitPrice.toLocaleString('ru-RU')} ₽/${shortName}`}
                                {formatMinPackageOrderHint(orderQtyOptions) && (
                                    <> · {unitPrice.toLocaleString('ru-RU')} ₽/{shortName}</>
                                )}
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {maxQty != null && (
                        <div
                            className={`rounded-lg p-3 text-center text-sm ${remainingLabel !== null && remainingLabel <= 0 ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'}`}
                        >
                            {remainingLabel != null && remainingLabel > 0 ? (
                                <>
                                    Доступно ещё:{' '}
                                    <strong>
                                        {remainingLabel} {shortName}
                                    </strong>
                                </>
                            ) : (
                                <strong>Весь остаток выбран</strong>
                            )}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                                {quantity % 1 === 0 ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '')}
                            </span>
                            <span className="ml-2 text-lg font-medium text-muted-foreground">{shortName}</span>
                        </div>
                        {minPackageAmount != null && minPackageUnit && !isSupplementMode && (
                            <p className="text-center text-xs text-muted-foreground">
                                Можно заказать: {minOrderQty}, {minOrderQty + orderStep}, {minOrderQty + orderStep * 2}{' '}
                                {minPackageUnit}…
                            </p>
                        )}

                        {isSupplementMode && maxQty != null && quantity < maxQty && (
                            <div className="flex justify-center">
                                <Button type="button" variant="secondary" size="sm" onClick={() => setQuantity(maxQty)}>
                                    Взять весь остаток ({maxQty} {shortName})
                                </Button>
                            </div>
                        )}

                        <div className="mx-auto grid max-w-xs grid-cols-4 gap-2">
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl px-1 text-xs sm:text-sm"
                                onClick={() => handleQuantityChange(-(orderStep * 10))}
                                disabled={quantity <= minOrderQty}
                            >
                                −{orderStep * 10}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-full rounded-xl"
                                onClick={() => handleQuantityChange(-orderStep)}
                                disabled={quantity <= minOrderQty}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-full rounded-xl"
                                onClick={() => handleQuantityChange(orderStep)}
                                disabled={maxQty !== null && quantity >= maxQty}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl px-1 text-xs sm:text-sm"
                                onClick={() => handleQuantityChange(orderStep * 10)}
                                disabled={maxQty !== null && quantity >= maxQty}
                            >
                                +{orderStep * 10}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">Итого</p>
                        <p className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
                            {total.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {quantity} {shortName} · {total.toLocaleString('ru-RU')} ₽
                        </p>
                        {packDiscountInfo != null && fullPacks > 0 && (
                            <p className="mt-2 text-xs text-success">
                                В сумму входит скидка за {fullPacks}{' '}
                                {fullPacks === 1 ? 'целую пачку' : 'целые пачки'} по{' '}
                                {packDiscountInfo.packSize} гр (
                                {packDiscountInfo.discountedPackPrice.toLocaleString('ru-RU')} ₽ за пачку, −
                                {packDiscountInfo.discountPercent}%)
                            </p>
                        )}
                        {packDiscountInfo != null && fullPacks === 0 && quantity > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Скидка за целую пачку {packDiscountInfo.packSize} гр — при заказе ровно{' '}
                                {packDiscountInfo.packSize} гр или кратно этому количеству
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={handleSubmit}
                        disabled={upsertMutation.isPending || !quantityValid}
                    >
                        {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Добавить в заказ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
