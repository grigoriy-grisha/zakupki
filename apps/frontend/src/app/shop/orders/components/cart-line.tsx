'use client';

import { getUnitByCode, isSupplementPhase, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { Minus, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useOrderMutations } from '@/app/shop/hooks/use-order-mutations';
import { activeOrderStep, linePriceBreakdown, unitPriceFromPriceInfo } from '@/app/shop/lib/cart-display';
import type { MergedOrderLine, OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { AppLink } from '@/components/app-link';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { formatPriceRub, formatRub } from '@/lib/format/money';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

interface CartLineProps {
    group: OrderPurchaseGroup;
    order: MergedOrderLine;
    editable: boolean;
}

export function CartLine({ group, order, editable }: CartLineProps) {
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const mutations = useOrderMutations(group.id, order.purchaseItemId);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const product = order.source?.purchaseItem?.product;
    const purchaseItem = order.source?.purchaseItem;
    const photo = product?.photos?.[0];
    const unitCode = purchaseItem?.unitCode ?? product?.unitCode ?? null;
    const unitShort = getUnitByCode(unitCode)?.shortName ?? 'ед.';
    const packSize = purchaseItem?.packAmount != null ? Number(purchaseItem.packAmount) : null;
    const hasPacks = packSize != null && packSize > 1;

    const unitPrice = unitPriceFromPriceInfo(order.source?.priceInfo);
    const breakdown = linePriceBreakdown(order);
    const step = activeOrderStep(purchaseItem ?? {}, fs);

    const floor = isSupplementPhase(fs) ? order.baseQuantity : 0;
    const canDecrease = order.quantity > floor + 1e-9;
    const showPackControls = hasPacks && (order.packageCount > 0 || !isSupplementPhase(fs));

    const priceLine =
        order.amountDue === 0 && (order.quantity > 0 || order.packageCount > 0)
            ? 'цена уточняется'
            : formatRub(order.amountDue);

    const breakdownLine =
        breakdown && (breakdown.orgFeeRub > 0 || breakdown.deliveryRub > 0)
            ? `${formatPriceRub(breakdown.baseRub)} + оргсбор ${formatPriceRub(breakdown.orgFeeRub)}${
                  breakdown.deliveryRub > 0 ? ` + доставка ${formatPriceRub(breakdown.deliveryRub)}` : ''
              }`
            : null;

    const isEmpty = order.quantity <= 0 && order.packageCount <= 0;

    async function removeLine() {
        try {
            let remaining = Math.round(order.quantity);
            while (remaining > 0) {
                const delta = Math.min(step, remaining);
                await mutations.adjust.mutateAsync({ purchaseItemId: order.purchaseItemId, delta: -delta });
                remaining -= delta;
            }
            let packs = order.packageCount;
            while (packs > 0) {
                await mutations.adjustPackage.mutateAsync({ purchaseItemId: order.purchaseItemId, delta: -1 });
                packs -= 1;
            }
            setConfirmOpen(false);
        } catch {
            return;
        }
    }

    return (
        <div className="py-3 sm:py-4">
            <div className="flex items-start gap-3 sm:gap-4">
                <AppLink
                    href={`/shop/purchase/${group.id}/item/${order.purchaseItemId}`}
                    className="block size-16 shrink-0 overflow-hidden rounded-xl bg-bg-card sm:size-20 sm:rounded-2xl"
                >
                    {photo ? (
                        <img
                            src={absoluteProductPhotoUrl(photo.id)}
                            alt={product?.name ?? ''}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-fg-tertiary">
                            <Package className="size-4 sm:size-5" />
                        </div>
                    )}
                </AppLink>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <AppLink href={`/shop/purchase/${group.id}/item/${order.purchaseItemId}`} className="min-w-0">
                            <PurchaseProductLabel
                                product={product}
                                className="min-w-0"
                                primaryClassName="block truncate font-display text-16-semibold leading-tight text-fg-primary transition-colors hover:text-secondary sm:text-18-semibold"
                                secondaryClassName="mt-0.5 block truncate text-12-regular text-fg-tertiary sm:text-13-regular"
                            />
                        </AppLink>
                        {editable ? (
                            <button
                                type="button"
                                aria-label="Убрать товар из заказа"
                                disabled={mutations.isPending || isEmpty}
                                onClick={() => setConfirmOpen(true)}
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                                    'border-2 border-error/60 text-error transition-colors',
                                    'hover:border-error hover:bg-error/10',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
                                )}
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        ) : null}
                    </div>

                    <p className="mt-1 text-13-medium text-fg-secondary tabular-nums sm:text-14-medium">
                        {unitPrice != null ? `${formatPriceRub(unitPrice)} / ${unitShort}` : 'цена уточняется'}
                    </p>
                    {breakdownLine && (
                        <p className="mt-0.5 text-12-regular text-fg-tertiary tabular-nums sm:text-13-regular">
                            {breakdownLine}
                        </p>
                    )}

                    {!editable && (
                        <p className="mt-1 text-14-semibold text-fg-primary tabular-nums sm:text-16-semibold">
                            {qtyLabelOf(order, unitShort)} · {priceLine}
                        </p>
                    )}
                </div>
            </div>

            {editable && (
                <div className="mt-3 flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:mt-4 sm:justify-end sm:gap-x-4">
                    <CartStepper
                        value={order.quantity > 0 ? `${order.quantity} ${unitShort}` : '—'}
                        onRemove={() =>
                            mutations.adjust.mutate({ purchaseItemId: order.purchaseItemId, delta: -step })
                        }
                        onAdd={() =>
                            mutations.adjust.mutate({ purchaseItemId: order.purchaseItemId, delta: step })
                        }
                        removeDisabled={!canDecrease || mutations.isPending}
                        addDisabled={mutations.isPending}
                        removeLabel="Убрать"
                        addLabel="Добавить"
                    />
                    {showPackControls ? (
                        <CartStepper
                            value={`${order.packageCount} уп`}
                            onRemove={() =>
                                mutations.adjustPackage.mutate({
                                    purchaseItemId: order.purchaseItemId,
                                    delta: -1,
                                })
                            }
                            onAdd={() =>
                                mutations.adjustPackage.mutate({
                                    purchaseItemId: order.purchaseItemId,
                                    delta: 1,
                                })
                            }
                            removeDisabled={order.packageCount <= 0 || mutations.isPending}
                            addDisabled={mutations.isPending}
                            removeLabel="Убрать упаковку"
                            addLabel="Добавить упаковку"
                        />
                    ) : null}
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Убрать товар из заказа?"
                description={
                    <>
                        «{product?.name ?? 'Товар'}» будет полностью удалён из вашего заказа
                        {isEmpty ? '' : ` (${qtyLabelOf(order, unitShort)})`}. На этапах добора действует
                        минимальный объём — если часть заказа уже зафиксирована, убрать можно только её остаток.
                    </>
                }
                confirmLabel="Убрать"
                loading={mutations.isPending}
                onConfirm={removeLine}
            />
        </div>
    );
}

function CartStepper({
    value,
    onRemove,
    onAdd,
    removeDisabled,
    addDisabled,
    removeLabel,
    addLabel,
}: {
    value: string;
    onRemove: () => void;
    onAdd: () => void;
    removeDisabled: boolean;
    addDisabled: boolean;
    removeLabel: string;
    addLabel: string;
}) {
    const btnBase =
        'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors sm:size-9';
    const btnRemove = cn(
        btnBase,
        'border-2 border-primary text-primary hover:bg-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-40',
    );
    const btnAdd = cn(
        btnBase,
        'bg-primary text-primary-foreground hover:bg-primary-hover',
        'disabled:cursor-not-allowed disabled:opacity-40',
    );

    return (
        <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
                type="button"
                onClick={onRemove}
                disabled={removeDisabled}
                aria-label={removeLabel}
                className={btnRemove}
            >
                <Minus className="size-3.5 sm:size-4" />
            </button>
            <div
                className={cn(
                    'flex h-8 min-w-0 flex-1 items-center justify-center rounded-full',
                    'border-2 border-primary px-2.5 text-12-bold text-primary tabular-nums',
                    'sm:h-9 sm:min-w-20 sm:flex-none sm:px-3 sm:text-13-bold',
                )}
            >
                <span className="truncate">{value}</span>
            </div>
            <button
                type="button"
                onClick={onAdd}
                disabled={addDisabled}
                aria-label={addLabel}
                className={btnAdd}
            >
                <Plus className="size-3.5 sm:size-4" />
            </button>
        </div>
    );
}

function qtyLabelOf(order: MergedOrderLine, unitShort: string): string {
    const parts: string[] = [];
    if (order.quantity > 0) parts.push(`${order.quantity} ${unitShort}`);
    if (order.packageCount > 0) parts.push(`${order.packageCount} уп`);
    return parts.join(' + ') || '—';
}
