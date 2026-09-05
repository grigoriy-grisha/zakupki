'use client';

import { formatQtyUnit } from '@zakupki/types';
import { Ban, Minus, Package, Plus } from 'lucide-react';

import type { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ItemOrderControls = ReturnType<typeof useItemOrderControls>;

function isLooseOrderable(ctx: ItemOrderControls): boolean {
    return ctx.currentQuantity > 0 || ctx.maxAllowed > ctx.currentQuantity;
}

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
                    'flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 sm:min-h-12',
                    'border border-border-low text-center text-12-medium leading-tight text-fg-tertiary sm:text-13-medium',
                )}
            >
                {ctx.orderingClosed ? <Ban className="size-3.5 shrink-0" /> : <Package className="size-3.5 shrink-0" />}
                <span>{ctx.orderingClosed ? 'Приём заказов завершён' : 'Разобрано'}</span>
            </div>
        );
    }

    if (ctx.hasOrder) {
        return <InCartControls ctx={ctx} stop={stop} />;
    }

    return (
        <div className="flex flex-col gap-1.5">
            {isLooseOrderable(ctx) && (
                <Button
                    variant="brand"
                    size="default"
                    className="h-10 w-full rounded-full text-13-bold sm:text-14-medium md:text-14-medium"
                    onClick={(e) => {
                        stop(e);
                        ctx.handleAdd();
                    }}
                    disabled={!ctx.canAdd || ctx.isPending}
                >
                    Добавить
                </Button>
            )}
            {ctx.showPackageButtons && ctx.packSize != null && ctx.canAddPackage && (
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
                            ({formatQtyUnit(ctx.packSize, ctx.shortName)})
                        </span>
                    </span>
                </Button>
            )}
        </div>
    );
}

function InCartControls({ ctx, stop }: { ctx: ItemOrderControls; stop: (e: React.MouseEvent) => void }) {
    if (!isLooseOrderable(ctx) && !(ctx.showPackageButtons && ctx.packSize != null)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1.5">
            {isLooseOrderable(ctx) && (
                <div className="flex items-center gap-2" onClick={stop} onPointerDown={stop}>
                    <button
                        type="button"
                        onClick={ctx.handleRemove}
                        disabled={!ctx.canDecrease || ctx.isPending}
                        aria-label="Убрать единицу товара"
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full',
                            'border-2 border-primary text-primary transition-colors',
                            'hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40',
                        )}
                    >
                        <Minus className="size-3.5" />
                    </button>
                    <div
                        className={cn(
                            'flex h-8 min-w-0 flex-1 items-center justify-center rounded-full',
                            'border-2 border-primary px-2 text-12-bold text-primary tabular-nums',
                        )}
                    >
                        <span className="truncate">{formatQtyUnit(ctx.currentQuantity, ctx.shortName)}</span>
                    </div>
                    <button
                        type="button"
                        onClick={ctx.handleAdd}
                        disabled={!ctx.canAdd || ctx.isPending}
                        aria-label="Добавить единицу товара"
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full',
                            'bg-primary text-primary-foreground transition-colors',
                            'hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
                        )}
                    >
                        <Plus className="size-3.5" />
                    </button>
                </div>
            )}
            {ctx.showPackageButtons &&
                ctx.packSize != null &&
                (ctx.canAddPackage || ctx.currentPackageCount > 0) && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={ctx.handleRemovePackage}
                            disabled={ctx.currentPackageCount <= 0 || ctx.isPending}
                            aria-label="Убрать упаковку"
                            className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-full',
                                'border-2 border-primary text-primary transition-colors',
                                'hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40',
                            )}
                        >
                            <Minus className="size-3.5" />
                        </button>
                        <div
                            className={cn(
                                'flex h-8 min-w-0 flex-1 items-center justify-center rounded-full',
                                'border-2 border-primary px-2 text-12-bold text-primary tabular-nums',
                            )}
                        >
                            <span className="truncate">{ctx.currentPackageCount} упак.</span>
                        </div>
                        <button
                            type="button"
                            onClick={ctx.handleAddPackage}
                            disabled={!ctx.canAddPackage || ctx.isPending}
                            aria-label="Добавить упаковку"
                            className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-full',
                                'bg-primary text-primary-foreground transition-colors',
                                'hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
                            )}
                        >
                            <Plus className="size-3.5" />
                        </button>
                    </div>
                )}
        </div>
    );
}
