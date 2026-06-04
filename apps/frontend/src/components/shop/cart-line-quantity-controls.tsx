'use client';

import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';
import { getMinOrderQuantity, getOrderQuantityStep, snapOrderQuantity } from '@zakupki/types';

type CartLineQuantityControlsProps = {
    orderId: number;
    purchaseItemId: number;
    purchaseId?: number;
    quantity: number;
    unitShort: string;
    multiplicity: number;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    purchaseItemMinQty: number | null;
};

export function CartLineQuantityControls({
    orderId,
    purchaseItemId,
    purchaseId,
    quantity,
    unitShort,
    multiplicity,
    minPackageAmount,
    minPackageUnit,
    purchaseItemMinQty,
}: CartLineQuantityControlsProps) {
    const utils = trpc.useUtils();

    const orderQtyOptions = {
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty,
        unitShort,
    };
    const orderStep = getOrderQuantityStep(orderQtyOptions);
    const minOrderQty = getMinOrderQuantity(orderQtyOptions);

    const invalidate = () => {
        void utils.orders.getMyOrders.invalidate();
        if (purchaseId != null) {
            void utils.purchases.getById.invalidate({ id: purchaseId });
        }
    };

    const upsertMutation = trpc.orders.upsertOrder.useMutation({
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const deleteMutation = trpc.orders.deleteOrder.useMutation({
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const pending = upsertMutation.isPending || deleteMutation.isPending;

    function handleAdd() {
        const next = snapOrderQuantity(quantity + orderStep, orderQtyOptions);
        upsertMutation.mutate({ purchaseItemId, quantity: next });
    }

    function handleRemove() {
        const next = quantity - orderStep;
        if (next < minOrderQty) {
            deleteMutation.mutate({ id: orderId });
            return;
        }
        const snapped = snapOrderQuantity(next, orderQtyOptions);
        upsertMutation.mutate({ purchaseItemId, quantity: snapped });
    }

    return (
        <div className="flex shrink-0 items-center gap-0.5">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={pending}
                aria-label={`Убрать ${orderStep} ${unitShort}`}
                onClick={handleRemove}
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[2.5rem] px-0.5 text-center text-sm font-medium tabular-nums">{quantity}</span>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={pending}
                aria-label={`Добавить ${orderStep} ${unitShort}`}
                onClick={handleAdd}
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
