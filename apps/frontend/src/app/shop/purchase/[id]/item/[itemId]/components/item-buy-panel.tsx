'use client';

import { Ban, Package, Percent } from 'lucide-react';

import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPriceRub } from '@/lib/format/money';
import { pluralRu } from '@/lib/format/plural';

import { formatQty,type ItemOrderControls } from './item-ctx';

export function ItemBuyPanel({ ctx, minHint }: { ctx: ItemOrderControls; minHint: string | null }) {
    const price = ctx.unitPriceRub ?? ctx.price;
    const packInfo = ctx.packDiscountInfo;
    // Packages bypass the supplement pool (whole packs, limited only by
    // supplierLimit), so "Разобрано" applies only when packages are off too.
    const packagesOrderable = ctx.showPackageButtons && ctx.canAddPackage;
    const soldOutNoOrder = ctx.isSoldOut && !ctx.hasOrder && !packagesOrderable;
    const orderingClosedNoOrder = ctx.orderingClosed && !ctx.hasOrder;

    return (
        <div className="flex flex-col gap-4 rounded-2xl bg-bg-soft p-4 sm:p-5">
            {price > 0 && (
                <div>
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="font-display text-24-semibold tabular-nums text-fg-primary sm:text-30-semibold">
                            {formatPriceRub(price)}
                        </span>
                        <span className="text-13-regular text-fg-tertiary">/ {ctx.shortName}</span>
                    </div>
                    {packInfo && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-full bg-secondary/10 px-3.5 py-2">
                            <Percent className="size-3.5 shrink-0 text-secondary" />
                            <p className="min-w-0 flex-1 text-12-medium text-fg-secondary">
                                Пачка {formatQty(packInfo.packSize)} {ctx.shortName} —{' '}
                                <span className="line-through text-fg-tertiary">
                                    {formatPriceRub(packInfo.packPrice)}
                                </span>{' '}
                                <span className="text-13-semibold text-secondary tabular-nums">
                                    {formatPriceRub(packInfo.discountedPackPrice)}
                                </span>
                            </p>
                            <Badge type="subtle" variant="accent" size="sm">
                                −{packInfo.discountPercent}%
                            </Badge>
                        </div>
                    )}
                </div>
            )}

            {ctx.hasOrder && (
                <div className="rounded-2xl bg-bg-card/70 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-12-medium text-fg-secondary">В заказе</span>
                        <span className="text-14-semibold text-fg-primary tabular-nums">
                            {formatQty(ctx.currentQuantity)} {ctx.shortName}
                            {ctx.currentPackageCount > 0 && (
                                <span className="text-fg-secondary"> + {ctx.currentPackageCount} упак.</span>
                            )}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-low pt-2">
                        <span className="text-12-medium text-fg-secondary">Итого</span>
                        <span className="font-display text-20-semibold text-primary tabular-nums">
                            {formatPriceRub(ctx.total)}
                        </span>
                    </div>
                    {ctx.fullPacks > 0 && (
                        <p className="mt-1.5 flex items-center gap-1 text-12-medium text-secondary">
                            <Percent className="size-3 shrink-0" />
                            Скидка за {ctx.fullPacks} {pluralRu(ctx.fullPacks, ['пачку', 'пачки', 'пачек'])} применена
                        </p>
                    )}
                </div>
            )}

            {soldOutNoOrder ? (
                <Button variant="secondary" className="h-10 w-full rounded-full" disabled>
                    <Package className="size-4" />
                    Разобрано
                </Button>
            ) : orderingClosedNoOrder ? (
                <Button variant="secondary" className="h-10 w-full rounded-full" disabled>
                    <Ban className="size-4" />
                    Приём заказов завершён
                </Button>
            ) : (
                <div className="flex flex-col gap-2">
                    <QuantityStepper
                        size="lg"
                        wrapClassName="hidden lg:flex"
                        value={
                            <>
                                {formatQty(ctx.currentQuantity)} {ctx.shortName}
                            </>
                        }
                        onRemove={ctx.handleRemove}
                        onAdd={ctx.handleAdd}
                        canRemove={ctx.canDecrease}
                        canAdd={ctx.canAdd}
                    />
                    {ctx.showPackageButtons && ctx.packSize != null && (
                        <QuantityStepper
                            size="md"
                            value={<>{formatQty(ctx.currentPackageCount)} упак.</>}
                            onRemove={ctx.handleRemovePackage}
                            onAdd={ctx.handleAddPackage}
                            canRemove={ctx.currentPackageCount > 0 && !ctx.isPending}
                            canAdd={ctx.canAddPackage && !ctx.isPending}
                            removeAriaLabel="Убрать упаковку"
                            addAriaLabel="Добавить упаковку"
                        />
                    )}
                    {minHint && <p className="text-center text-12-regular text-fg-tertiary">{minHint}</p>}
                </div>
            )}
        </div>
    );
}
