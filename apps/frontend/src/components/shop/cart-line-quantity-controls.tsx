'use client';

import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';
import { getOrderQuantityStep, buildOrderQtyOptions } from '@zakupki/types';

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

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty,
        unitShort,
    });
    const orderStep = getOrderQuantityStep(orderQtyOptions);

    const invalidate = () => {
        void utils.orders.getMyOrders.invalidate();
        if (purchaseId != null) {
            void utils.purchases.getById.invalidate({ id: purchaseId });
        }
    };

    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const deleteMutation = trpc.orders.deleteOrder.useMutation({
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const pending = adjustMutation.isPending || deleteMutation.isPending;

    function handleAdd() {
        adjustMutation.mutate({ purchaseItemId, delta: orderStep });
    }

    function handleRemove() {
        if (quantity <= orderStep) {
            deleteMutation.mutate({ id: orderId });
            return;
        }
        adjustMutation.mutate({ purchaseItemId, delta: -orderStep });
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