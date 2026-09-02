'use client';

import { Plus } from 'lucide-react';

import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { Button } from '@/components/ui/button';
import { formatPriceRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

import { formatQty,type ItemOrderControls } from './item-ctx';

export function MobileOrderBar({ ctx }: { ctx: ItemOrderControls }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-low bg-bg-base/95 backdrop-blur lg:hidden">
            <div
                className={cn(
                    'mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-2.5',
                    'pb-[calc(0.625rem+env(safe-area-inset-bottom))]',
                )}
            >
                <div className="min-w-0 flex-1">
                    <p className="text-11-medium uppercase tracking-wide text-fg-tertiary">
                        {ctx.hasOrder ? 'В корзине' : `Цена за ${ctx.shortName}`}
                    </p>
                    <p className="truncate text-16-semibold tabular-nums text-fg-primary">
                        {ctx.hasOrder
                            ? formatPriceRub(ctx.total)
                            : `${formatPriceRub(ctx.unitPriceRub ?? ctx.price)} / ${ctx.shortName}`}
                    </p>
                </div>
                {ctx.hasOrder ? (
                    (ctx.currentQuantity > 0 || ctx.maxAllowed > ctx.currentQuantity) ? (
                        <QuantityStepper
                            size="md"
                            wrapClassName="shrink-0"
                            value={
                                <>
                                    {formatQty(ctx.currentQuantity)} {ctx.shortName}
                                    {ctx.currentPackageCount > 0 ? ` + ${ctx.currentPackageCount} упак.` : ''}
                                </>
                            }
                            onRemove={ctx.handleRemove}
                            onAdd={ctx.handleAdd}
                            canRemove={ctx.canDecrease}
                            canAdd={ctx.canAdd}
                        />
                    ) : null
                ) : (
                    <Button
                        variant="brand"
                        className="h-10 shrink-0 rounded-full px-5"
                        onClick={ctx.handleAdd}
                        disabled={!ctx.canAdd || ctx.isPending}
                    >
                        <Plus className="size-4" />
                        Добавить
                    </Button>
                )}
            </div>
        </div>
    );
}
