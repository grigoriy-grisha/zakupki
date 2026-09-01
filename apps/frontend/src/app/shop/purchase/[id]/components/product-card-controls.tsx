'use client';

import { Ban, Minus, Package, Plus } from 'lucide-react';

import type { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
            <div
                className={cn(
                    'flex h-10 w-full items-center justify-center gap-1.5 rounded-full sm:h-12',
                    'border border-border-low text-13-medium text-fg-tertiary',
                )}
            >
                {ctx.orderingClosed ? <Ban className="size-3.5" /> : <Package className="size-3.5" />}
                {ctx.orderingClosed ? 'Приём заказов завершён' : 'Разобрано'}
            </div>
        );
    }

    if (ctx.hasOrder) {
        return <InCartControls ctx={ctx} stop={stop} />;
    }

    return (
        <div className="flex flex-col gap-1.5">
            <Button
                variant="brand"
                size="default"
                className="h-10 w-full rounded-full text-13-bold sm:h-12 sm:text-14-bold"
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
                    className="h-9 w-full justify-center rounded-full border-border-low text-12-medium"
                    onClick={(e) => {
                        stop(e);
                        ctx.handleAddPackage();
                    }}
                    disabled={!ctx.canAddPackage || ctx.isPending}
                >
                    <Plus className="mr-1 size-3 shrink-0" />
                    <span className="truncate">
                        1 упаковка
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

function InCartControls({ ctx, stop }: { ctx: ItemOrderControls; stop: (e: React.MouseEvent) => void }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2" onClick={stop} onPointerDown={stop}>
                <button
                    type="button"
                    onClick={ctx.handleRemove}
                    disabled={!ctx.canDecrease || ctx.isPending}
                    aria-label="Убрать единицу товара"
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        'border-2 border-primary text-primary transition-colors',
                        'hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                >
                    <Minus className="size-4" />
                </button>
                <div
                    className={cn(
                        'flex h-9 min-w-0 flex-1 items-center justify-center rounded-full',
                        'border-2 border-primary px-2 text-13-bold text-primary tabular-nums',
                    )}
                >
                    <span className="truncate">
                        {ctx.currentQuantity} {ctx.shortName}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={ctx.handleAdd}
                    disabled={!ctx.canAdd || ctx.isPending}
                    aria-label="Добавить единицу товара"
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        'bg-primary text-primary-foreground transition-colors',
                        'hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                >
                    <Plus className="size-4" />
                </button>
            </div>
            {ctx.showPackageButtons && ctx.packSize != null && (
                <div className="flex items-stretch gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center rounded-full border-border-low text-12-medium"
                        onClick={ctx.handleRemovePackage}
                        disabled={ctx.currentPackageCount <= 0 || ctx.isPending}
                        aria-label="Убрать упаковку"
                    >
                        <span className="truncate">− 1 упак.</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center rounded-full border-border-low text-12-medium"
                        onClick={ctx.handleAddPackage}
                        disabled={!ctx.canAddPackage || ctx.isPending}
                    >
                        <span className="truncate">+ 1 упак.</span>
                    </Button>
                </div>
            )}
        </div>
    );
}
