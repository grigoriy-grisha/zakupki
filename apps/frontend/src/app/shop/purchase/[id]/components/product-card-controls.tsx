'use client';

import { Ban, Package, Plus } from 'lucide-react';

import type { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { Button } from '@/components/ui/button';

type ItemOrderControls = ReturnType<typeof useItemOrderControls>;

export function ProductCardControls({
    ctx,
    isSoldOutNoOrder,
    stop,
}: {
    ctx: ItemOrderControls;
    isSoldOutNoOrder: boolean;
    stop: (e: React.MouseEvent) => void;
}) {
    if (isSoldOutNoOrder || ctx.orderingClosed) {
        return (
            <Button className="h-9 w-full rounded-lg text-12-medium" variant="secondary" size="default" disabled>
                {ctx.orderingClosed ? <Ban className="mr-1 size-3.5" /> : <Package className="mr-1 size-3.5" />}
                {ctx.orderingClosed ? 'Приём заказов завершён' : 'Разобрано'}
            </Button>
        );
    }

    if (ctx.hasOrder) {
        return <InCartControls ctx={ctx} />;
    }

    return (
        <div className="flex flex-col gap-1">
            <Button
                variant="brand"
                size="default"
                className="h-8 w-full rounded-lg text-12-semibold sm:h-9"
                onClick={(e) => {
                    stop(e);
                    ctx.handleAdd();
                }}
                disabled={!ctx.canAdd || ctx.isPending}
            >
                Добавить
            </Button>
            {ctx.showPackageButtons && ctx.packSize != null && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-center text-12-medium"
                    onClick={(e) => {
                        stop(e);
                        ctx.handleAddPackage();
                    }}
                    disabled={!ctx.canAddPackage || ctx.isPending}
                >
                    <Plus className="mr-1 size-3 shrink-0" />
                    <span className="truncate">
                        +1 упаковка
                        <span className="hidden sm:inline">
                            {' '}
                            ({ctx.packSize} {ctx.shortName})
                        </span>
                    </span>
                </Button>
            )}
        </div>
    );
}

function InCartControls({ ctx }: { ctx: ItemOrderControls }) {
    return (
        <div className="flex flex-col gap-1.5">
            <QuantityStepper
                size="sm"
                value={
                    <span className="truncate">
                        {ctx.currentQuantity} {ctx.shortName}
                    </span>
                }
                onRemove={ctx.handleRemove}
                onAdd={ctx.handleAdd}
                canRemove={ctx.canDecrease}
                canAdd={ctx.canAdd}
            />
            {ctx.showPackageButtons && ctx.packSize != null && (
                <div className="flex items-stretch gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center text-12-medium"
                        onClick={ctx.handleRemovePackage}
                        disabled={ctx.currentPackageCount <= 0 || ctx.isPending}
                        aria-label="Убрать упаковку"
                    >
                        <span className="truncate">− 1 упак.</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center text-12-medium"
                        onClick={ctx.handleAddPackage}
                        disabled={!ctx.canAddPackage || ctx.isPending}
                    >
                        <span className="truncate">
                            + 1 упак.
                            <span className="hidden sm:inline">
                                {' '}
                                ({ctx.packSize} {ctx.shortName})
                            </span>
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
}
