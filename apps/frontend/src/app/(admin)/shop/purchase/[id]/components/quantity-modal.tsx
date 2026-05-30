'use client';

import { useState } from 'react';
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
import { calculateOrderAmount } from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuantityModalProps {
    purchaseItemId: number;
    purchaseId: number;
    currentQuantity?: number;
    onClose: () => void;
}

export function QuantityModal({ purchaseItemId, purchaseId, currentQuantity, onClose }: QuantityModalProps) {
    const utils = trpc.useUtils();

    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const item = purchase?.items.find((i) => i.id === purchaseItemId);

    const unit = item?.product?.unit;
    const multiplicity = unit ? Number(unit.multiplicity) : 1;
    const minQty = item?.minQty ? Number(item.minQty) : multiplicity;
    const availableQty =
        item?.availableQty !== null && item?.availableQty !== undefined ? Number(item.availableQty) : null;

    const startQty = Math.max(multiplicity, minQty);
    const roundedStart = Math.ceil(startQty / multiplicity) * multiplicity;
    const effectiveStart = availableQty !== null ? Math.min(roundedStart, availableQty) : roundedStart;

    const [quantity, setQuantity] = useState(currentQuantity ?? effectiveStart);

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
    };

    const shortName = unit.shortName;
    const unitPrice = Number(item.priceOverride ?? product.pricePerUnit);
    const total = calculateOrderAmount(quantity, {
        priceTiers: product.priceTiers,
        pricePerUnit: Number(product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
    });

    // availableQty = remaining stock in DB (already decremented for current user's order in supplement mode)
    // But if the order was placed BEFORE supplement mode, availableQty doesn't account for it.
    // So max = currentQuantity + availableQty (user can keep what they have + take remaining)
    const currentQty = currentQuantity ?? 0;
    const maxQty = availableQty !== null ? currentQty + availableQty : null; // null = unlimited
    const remainingLabel = availableQty; // how much MORE can be added

    function handleQuantityChange(delta: number) {
        setQuantity((prev) => {
            const next = Number((prev + delta).toFixed(3));
            const capped = Math.max(multiplicity, next);
            return maxQty !== null ? Math.min(capped, maxQty) : capped;
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
                        {product.minPackageAmount != null &&
                            product.minPackageUnit &&
                            `Мин. фасовка: ${Number(product.minPackageAmount)} ${product.minPackageUnit} · `}
                        {unitPrice.toLocaleString('ru-RU')} ₽/{shortName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {remainingLabel !== null &&
                        (() => {
                            const afterConfirm = maxQty !== null ? maxQty - quantity : remainingLabel;
                            return (
                                <div
                                    className={`rounded-lg p-3 text-center text-sm ${afterConfirm <= 0 ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'}`}
                                >
                                    {afterConfirm > 0 ? (
                                        <>
                                            Доступно ещё:{' '}
                                            <strong>
                                                {afterConfirm} {shortName}
                                            </strong>
                                        </>
                                    ) : (
                                        <strong>Весь остаток выбран</strong>
                                    )}
                                </div>
                            );
                        })()}

                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                                {quantity % 1 === 0 ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '')}
                            </span>
                            <span className="ml-2 text-lg font-medium text-muted-foreground">{shortName}</span>
                        </div>

                        <div className="mx-auto grid max-w-xs grid-cols-4 gap-2">
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl px-1 text-xs sm:text-sm"
                                onClick={() => handleQuantityChange(-(multiplicity * 10))}
                                disabled={quantity <= multiplicity}
                            >
                                −{multiplicity * 10}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-full rounded-xl"
                                onClick={() => handleQuantityChange(-multiplicity)}
                                disabled={quantity <= multiplicity}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-full rounded-xl"
                                onClick={() => handleQuantityChange(multiplicity)}
                                disabled={maxQty !== null && quantity >= maxQty}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl px-1 text-xs sm:text-sm"
                                onClick={() => handleQuantityChange(multiplicity * 10)}
                                disabled={maxQty !== null && quantity >= maxQty}
                            >
                                +{multiplicity * 10}
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
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={handleSubmit}
                        disabled={upsertMutation.isPending || quantity <= 0}
                    >
                        {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Добавить в заказ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
