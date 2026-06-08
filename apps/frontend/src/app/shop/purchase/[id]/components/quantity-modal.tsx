'use client';

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
    calculateOrderAmount,
    countFullSupplierPacks,
    formatMinPackageOrderHint,
    getUnitByCode,
    getPackDiscountPricingInfo,
    getSupplementPool,
    buildOrderQtyOptions,
    getOrderQuantityStep,
    getMinOrderQuantity,
    isSupplementPhase,
} from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuantityModalProps {
    purchaseItemId: number;
    purchaseId: number;
    packDiscountPercent: number;
    /** Текущее количество этого пользователя (0 если заказа не было). */
    currentQuantity: number;
    /** Количество упаковок поставщика у этого пользователя. */
    packageCount?: number;
    /** baseQuantity — зафиксированное количество при входе в SUPPLEMENT/REORDER (для расчёта пула). */
    baseQuantity?: number;
    onClose: () => void;
}

export function QuantityModal({
    purchaseItemId,
    purchaseId,
    packDiscountPercent,
    currentQuantity,
    packageCount = 0,
    baseQuantity = 0,
    onClose,
}: QuantityModalProps) {
    const utils = trpc.useUtils();

    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);

    const unitCode = item?.product?.unitCode;
    const unit = unitCode ? getUnitByCode(unitCode) : undefined;
    const multiplicity = item?.product?.multiplicity ? Number(item?.product?.multiplicity) : 1;
    const minPackageAmount = item?.product?.minPackageAmount != null ? Number(item?.product?.minPackageAmount) : null;
    const minPackageUnit = item?.product?.minPackageUnit ?? null;

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: null,
        unitShort: unit?.shortName ?? 'ед.',
    });

    const minPackaging = getOrderQuantityStep(orderQtyOptions);
    const minOrder = getMinOrderQuantity(orderQtyOptions);

    const isSupplement = isSupplementPhase(purchase?.fulfillmentStatus ?? 'COLLECTION');
    const packSize = item?.product?.supplierPackageAmount != null ? Number(item?.product?.supplierPackageAmount) : null;

    // Сумма quantity всех пользователей (для расчёта пула добора)
    const activeLines = (item?.orderLines ?? []).filter(
        (line: { status?: string | null }) => (line as any).status !== 'CANCELLED',
    );
    const totalOrderedQuantity = activeLines.reduce(
        (acc: number, line: { quantity?: unknown }) => acc + Number(line.quantity ?? 0),
        0,
    );
    // Сколько пользователи уже добрали сверх базового заказа
    const supplementClaimed = activeLines.reduce(
        (acc: number, line: { quantity?: unknown; baseQuantity?: unknown }) => {
            return acc + Math.max(0, Number(line.quantity ?? 0) - Number(line.baseQuantity ?? 0));
        },
        0,
    );
    // Σ(baseQuantity) — замороженное количество для фиксации пачек
    const totalBaseQuantity = activeLines.reduce(
        (acc: number, line: { baseQuantity?: unknown }) => acc + Number(line.baseQuantity ?? 0),
        0,
    );

    // Пул добора
    const rawAvailableQty =
        item?.targetRemainder !== null && item?.targetRemainder !== undefined ? Number(item.targetRemainder) : null;
    const poolRemainder = getSupplementPool({
        targetRemainder: rawAvailableQty,
        totalOrderedQuantity,
        supplementClaimed,
        packSize,
        totalBaseQuantity,
    });
    const maxPool = poolRemainder == null ? Number.POSITIVE_INFINITY : poolRemainder;

    // Mutations: одна мутация adjustQuantity с delta = +/- minPackaging
    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            utils.orders.getMyOrders.invalidate();
            utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const packageMutation = trpc.orders.adjustPackageCount.useMutation({
        onSuccess: () => {
            utils.orders.getMyOrders.invalidate();
            utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const orderBusy = adjustMutation.isPending || packageMutation.isPending;

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

    // Упаковка
    const modalPackSize = packSize ?? 0;
    const hasSupplierPackage = modalPackSize > 0;
    const pkgPrice =
        product.supplierPackagePrice != null && Number(product.supplierPackagePrice) > 0
            ? Number(product.supplierPackagePrice)
            : Number(product.pricePerUnit) * modalPackSize;
    const packageTotal = packageCount * pkgPrice;
    const fulfillmentStatus = purchase?.fulfillmentStatus ?? 'COLLECTION';
    const showPackageButtons =
        (fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER') && hasSupplierPackage;

    const total = calculateOrderAmount(currentQuantity, pricingOptions) + packageTotal;
    const packDiscountInfo = getPackDiscountPricingInfo(product, packDiscountPercent);
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

    const remainingPool = maxPool !== Number.POSITIVE_INFINITY ? Math.max(0, maxPool - (currentQuantity - baseQuantity)) : null;

    function handleAdd() {
        adjustMutation.mutate({ purchaseItemId, delta: minPackaging });
    }

    function handleRemove() {
        if (currentQuantity <= minPackaging) {
            // Уменьшаем до 0
            adjustMutation.mutate({ purchaseItemId, delta: -currentQuantity });
        } else {
            adjustMutation.mutate({ purchaseItemId, delta: -minPackaging });
        }
    }

    const canAdd = currentQuantity + minPackaging <= maxPool || maxPool === Number.POSITIVE_INFINITY;
    const canRemove = currentQuantity > 0;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="pr-6 text-left">
                        <PurchaseProductLabel product={item.product} primaryClassName="text-lg font-semibold" />
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {formatMinPackageOrderHint(orderQtyOptions) ??
                            `${unitPrice.toLocaleString('ru-RU')} ₽/${shortName}`}
                        {' · '}
                        {unitPrice.toLocaleString('ru-RU')} ₽/{shortName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Пул добора */}
                    {isSupplement && remainingPool != null && (
                        <div
                            className={`rounded-lg p-3 text-center text-sm ${
                                remainingPool <= 0 ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'
                            }`}
                        >
                            {remainingPool > 0 ? (
                                <>
                                    Доступно ещё:{' '}
                                    <strong>
                                        {remainingPool} {shortName}
                                    </strong>
                                </>
                            ) : (
                                <strong>Весь остаток выбран</strong>
                            )}
                        </div>
                    )}

                    {/* Количество */}
                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                                {currentQuantity % 1 === 0
                                    ? currentQuantity
                                    : currentQuantity.toFixed(3).replace(/\.?0+$/, '')}
                            </span>
                            <span className="ml-2 text-lg font-medium text-muted-foreground">{shortName}</span>
                        </div>
                        {minPackageAmount != null && minPackageUnit && (
                            <p className="text-center text-xs text-muted-foreground">
                                Мин. фасовка: {minOrder} {minPackageUnit}
                            </p>
                        )}

                        {/* Две кнопки: −мин.фасовка и +мин.фасовка */}
                        <div className="mx-auto grid max-w-xs grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-12 rounded-xl text-sm font-medium"
                                onClick={handleRemove}
                                disabled={!canRemove || orderBusy}
                            >
                                <Minus className="mr-1 h-4 w-4" />
                                −{minPackaging} {shortName}
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 rounded-xl text-sm font-medium"
                                onClick={handleAdd}
                                disabled={!canAdd || orderBusy}
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                +{minPackaging} {shortName}
                            </Button>
                        </div>

                        {/* ±упаковка поставщика */}
                        {showPackageButtons && (
                            <div className="mx-auto grid max-w-xs grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl text-sm font-medium"
                                    disabled={orderBusy || packageCount <= 0}
                                    onClick={() => packageMutation.mutate({ purchaseItemId, delta: -1 })}
                                >
                                    <Minus className="mr-1 h-4 w-4" />
                                    −Упак.
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl text-sm font-medium"
                                    disabled={orderBusy}
                                    onClick={() => packageMutation.mutate({ purchaseItemId, delta: 1 })}
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    +Упак. ({modalPackSize} {shortName})
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Итого */}
                    <div className="rounded-xl bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">Итого</p>
                        <p className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
                            {total.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {currentQuantity > 0 && `${currentQuantity} ${shortName}`}
                            {currentQuantity > 0 && packageCount > 0 && ' + '}
                            {packageCount > 0 && `${packageCount} упак.`} · {total.toLocaleString('ru-RU')} ₽
                        </p>
                        {packDiscountInfo != null && fullPacks > 0 && (
                            <p className="mt-2 text-xs text-success">
                                Скидка за {fullPacks} {fullPacks === 1 ? 'целую пачку' : 'целые пачки'} по{' '}
                                {packDiscountInfo.packSize} гр (
                                {packDiscountInfo.discountedPackPrice.toLocaleString('ru-RU')} ₽ за пачку, −
                                {packDiscountInfo.discountPercent}%)
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Закрыть
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}