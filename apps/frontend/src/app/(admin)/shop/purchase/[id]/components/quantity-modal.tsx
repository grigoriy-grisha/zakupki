'use client';

import { useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
    const availableQty = item?.availableQty !== null && item?.availableQty !== undefined ? Number(item.availableQty) : null;

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

    const price = Number(item.priceOverride ?? item.product.pricePerUnit);
    const shortName = unit.shortName;
    const total = quantity * price;

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{item.product.name}</DialogTitle>
                    <DialogDescription>
                        {item.product.brand && `${item.product.brand} · `}
                        {price.toLocaleString('ru-RU')} ₽/{shortName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Available stock indicator */}
                    {remainingLabel !== null && (() => {
                        const afterConfirm = maxQty !== null ? maxQty - quantity : remainingLabel;
                        return (
                            <div className={`rounded-lg p-3 text-center text-sm ${afterConfirm <= 0 ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'}`}>
                                {afterConfirm > 0 ? (
                                    <>Доступно ещё: <strong>{afterConfirm} {shortName}</strong></>
                                ) : (
                                    <strong>Весь остаток выбран</strong>
                                )}
                            </div>
                        );
                    })()}

                    {/* Quantity Selector */}
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full"
                            onClick={() => handleQuantityChange(-(multiplicity * 10))}
                            disabled={quantity <= multiplicity}
                        >
                            {-multiplicity * 10}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => handleQuantityChange(-multiplicity)}
                            disabled={quantity <= multiplicity}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                            <span className="min-w-[5rem] text-center text-2xl font-bold tabular-nums">
                                {quantity % 1 === 0 ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '')}
                            </span>
                            <span className="text-lg font-medium text-muted-foreground">{shortName}</span>
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => handleQuantityChange(multiplicity)}
                            disabled={maxQty !== null && quantity >= maxQty}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full"
                            onClick={() => handleQuantityChange(multiplicity * 10)}
                            disabled={maxQty !== null && quantity >= maxQty}
                        >
                            +{multiplicity * 10}
                        </Button>
                    </div>

                    {/* Total */}
                    <div className="rounded-xl bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">Итого</p>
                        <p className="mt-1 text-3xl font-bold text-primary">
                            {total.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {quantity} {shortName} × {price.toLocaleString('ru-RU')} ₽
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button onClick={handleSubmit} disabled={upsertMutation.isPending || quantity <= 0}>
                        {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Добавить в заказ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
