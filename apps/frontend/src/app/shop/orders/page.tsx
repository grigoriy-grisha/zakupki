'use client';

import {
    computeOrderLinePriceBreakdown,
    getUnitByCode,
    HANDOFF_STATUS_LABELS,
    type HandoffStatus,
    isPurchaseCompleted,
    isPurchasePaymentOpen,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
} from '@zakupki/types';
import {
    Archive,
    Boxes,
    ChevronRight,
    ClipboardList,
    Package,
    PackageCheck,
    Send,
    Truck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useHandoffChoice } from '@/app/shop/hooks/use-handoff-choice';
import { groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { HandoffMessageCard } from '@/app/shop/orders/components/handoff-message-card';
import { MyPaymentRow } from '@/app/shop/orders/components/my-payment-row';
import { PaymentStatusBlock } from '@/app/shop/orders/components/payment-status-block';
import { AppLink } from '@/components/app-link';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { type ShopPaymentView, summarizePurchasePayments } from '@/components/shop/payment-proof';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { formatPriceRub, formatRub } from '@/lib/format/money';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import type { ProductLabelSource } from '@/lib/product-label';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

type OrdersTab = 'active' | 'past';

const HANDOFF_PILL_STYLES: Record<HandoffStatus, { label: string; icon: typeof Truck; className: string }> = {
    ASSEMBLED: {
        label: HANDOFF_STATUS_LABELS.ASSEMBLED,
        icon: Boxes,
        className: 'border-primary/40 bg-primary/10 text-primary',
    },
    READY_TO_SHIP: {
        label: HANDOFF_STATUS_LABELS.READY_TO_SHIP,
        icon: Send,
        className: 'border-accent-teal/40 bg-accent-teal/10 text-accent-teal',
    },
    SENT: {
        label: HANDOFF_STATUS_LABELS.SENT,
        icon: Truck,
        className: 'border-secondary/40 bg-secondary/10 text-secondary',
    },
    RECEIVED: {
        label: HANDOFF_STATUS_LABELS.RECEIVED,
        icon: PackageCheck,
        className: 'border-success/40 bg-success/10 text-success',
    },
    STORED: {
        label: HANDOFF_STATUS_LABELS.STORED,
        icon: Archive,
        className: 'border-warning/40 bg-warning/10 text-warning',
    },
};

function HandoffPill({ status }: { status: string }) {
    const style = HANDOFF_PILL_STYLES[status as HandoffStatus];
    if (!style) return null;
    const Icon = style.icon;
    return (
        <span
            className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-12-medium',
                style.className,
            )}
        >
            <Icon className="size-3" />
            {style.label}
        </span>
    );
}

function OrdersEmptyState({
    title,
    description,
    showShopLink = false,
}: {
    title: string;
    description: string;
    showShopLink?: boolean;
}) {
    const router = useAppRouter();

    return (
        <EmptyState
            variant="plain"
            icon={ClipboardList}
            title={title}
            description={description}
            actionLabel={showShopLink ? 'К закупкам' : undefined}
            onAction={showShopLink ? () => router.push('/shop') : undefined}
        />
    );
}

function OrdersSegmentedTabs({
    tab,
    onTabChange,
    activeCount,
    pastCount,
}: {
    tab: OrdersTab;
    onTabChange: (tab: OrdersTab) => void;
    activeCount: number;
    pastCount: number;
}) {
    return (
        <div
            className="inline-flex w-fit max-w-full self-center overflow-hidden rounded-full border-2 border-secondary sm:self-start"
            role="tablist"
        >
            <button
                type="button"
                role="tab"
                aria-selected={tab === 'active'}
                onClick={() => onTabChange('active')}
                className={cn(
                    'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3',
                    'text-12-bold transition-colors sm:h-9 sm:px-4 sm:text-13-medium',
                    tab === 'active' ? 'bg-secondary text-primary-foreground' : 'text-secondary hover:bg-secondary/10',
                )}
            >
                Активные заказы
                {activeCount > 0 && <span className="tabular-nums">{activeCount}</span>}
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={tab === 'past'}
                onClick={() => onTabChange('past')}
                className={cn(
                    'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3',
                    'text-12-bold transition-colors sm:h-9 sm:px-4 sm:text-13-medium',
                    tab === 'past' ? 'bg-secondary text-primary-foreground' : 'text-secondary hover:bg-secondary/10',
                )}
            >
                Прошлые заказы
                {pastCount > 0 && <span className="tabular-nums">{pastCount}</span>}
            </button>
        </div>
    );
}

function PurchaseOrderCard({
    group,
    myPayments,
    isPast,
}: {
    group: OrderPurchaseGroup;
    myPayments: { purchaseId: number; status: string; amount: unknown; children?: { amount: unknown }[] }[] | undefined;
    isPast: boolean;
}) {
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const purchaseStatus = group.status as PurchaseStatus;
    const completed = isPurchaseCompleted(purchaseStatus);

    const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
    const paymentSummary = summarizePurchasePayments(group.total, purchasePayments);
    const { remaining, hasPending, isFullyPaid } = paymentSummary;
    const paymentOpen = !completed && isPurchasePaymentOpen(fs);

    const ordersWithBreakdown = group.orders.map((order) => {
        const priceInfo = order.source.priceInfo as
            | {
                  pricePerPackCurrency: number | null;
                  rateToRub: number | null;
                  packSize: number | null;
                  orgFeePercent: number;
                  deliveryPercent: number;
              }
            | null
            | undefined;
        const breakdown = priceInfo
            ? computeOrderLinePriceBreakdown({
                  amountDue: order.amountDue,
                  quantity: order.quantity,
                  packageCount: order.packageCount,
                  pricePerPackCurrency: priceInfo.pricePerPackCurrency,
                  rateToRub: priceInfo.rateToRub,
                  packSize: priceInfo.packSize,
                  orgFeePercent: priceInfo.orgFeePercent,
                  deliveryPercent: priceInfo.deliveryPercent,
              })
            : null;
        return { order, breakdown };
    });
    const totals =
        ordersWithBreakdown.length > 0 && ordersWithBreakdown.every(({ breakdown }) => breakdown != null)
            ? ordersWithBreakdown.reduce(
                  (acc, { breakdown }) => ({
                      base: acc.base + breakdown!.baseRub,
                      org: acc.org + breakdown!.orgFeeRub,
                      delivery: acc.delivery + breakdown!.deliveryRub,
                  }),
                  { base: 0, org: 0, delivery: 0 },
              )
            : null;

    const handoffChoice = useHandoffChoice();
    const handoffStatus = (group.handoffStatus ?? null) as HandoffStatus | null;

    return (
        <section className="py-5 first:pt-0 last:pb-0 sm:py-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {group.orderNumber != null && (
                        <p className="text-13-regular text-fg-secondary tabular-nums sm:text-14-regular">
                            Заказ №{group.orderNumber}
                        </p>
                    )}
                    <AppLink href={`/shop/purchase/${group.id}`} className="group/title mt-0.5 inline-block">
                        <h3
                            className={cn(
                                'font-display text-24-bold leading-tight text-secondary transition-colors',
                                'group-hover/title:text-primary sm:text-30-semibold',
                            )}
                        >
                            {group.tag}
                        </h3>
                    </AppLink>
                </div>
                {handoffStatus && <HandoffPill status={handoffStatus} />}
            </div>

            <div className="mt-5 divide-y divide-border-low sm:mt-6">
                {ordersWithBreakdown.map(({ order, breakdown }) => {
                    const product: (ProductLabelSource & { photos: { id: number }[]; unitCode: string }) | undefined =
                        order.source.purchaseItem?.product;
                    const purchaseItemUnit = order.source.purchaseItem?.unitCode;
                    const shortName = getUnitByCode(purchaseItemUnit ?? product?.unitCode)?.shortName ?? '';
                    const photo = product?.photos?.[0];
                    const qty = order.quantity;
                    const amount = order.amountDue;
                    const qtyParts: string[] = [];
                    if (qty > 0) qtyParts.push(`${qty} ${shortName}`);
                    if (order.packageCount > 0) qtyParts.push(`${order.packageCount} упак.`);
                    const qtyLabel = qtyParts.join(' + ');

                    return (
                        <AppLink
                            key={order.purchaseItemId}
                            href={`/shop/purchase/${group.id}/item/${order.purchaseItemId}`}
                            className={cn(
                                'group flex items-center gap-3 rounded-xl px-1 py-2.5 sm:gap-4 sm:py-3',
                                'transition-colors hover:bg-bg-card/60',
                            )}
                        >
                            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-bg-card sm:size-20 sm:rounded-2xl">
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
                            </div>
                            <div className="min-w-0 flex-1">
                                {product && (
                                    <PurchaseProductLabel
                                        product={product}
                                        className="min-w-0"
                                        primaryClassName={cn(
                                            'block font-display text-16-semibold leading-tight text-fg-primary',
                                            'transition-colors group-hover:text-secondary sm:text-18-semibold',
                                        )}
                                        secondaryClassName="mt-0.5 block truncate text-12-regular text-fg-tertiary sm:text-13-regular"
                                    />
                                )}
                                <p className="mt-0.5 text-14-semibold text-fg-primary tabular-nums sm:text-16-semibold">
                                    {qtyLabel} · {formatRub(amount)}
                                </p>
                                {breakdown && (breakdown.orgFeeRub > 0 || breakdown.deliveryRub > 0) && (
                                    <p className="mt-0.5 text-14-medium text-fg-secondary tabular-nums">
                                        {formatPriceRub(breakdown.baseRub)} + оргсбор{' '}
                                        {formatPriceRub(breakdown.orgFeeRub)}
                                        {breakdown.deliveryRub > 0
                                            ? ` + доставка ${formatPriceRub(breakdown.deliveryRub)}`
                                            : ''}
                                    </p>
                                )}
                            </div>
                            <ChevronRight
                                className={cn(
                                    'size-4 shrink-0 text-fg-tertiary opacity-0',
                                    'transition-opacity group-hover:opacity-100',
                                )}
                            />
                        </AppLink>
                    );
                })}
            </div>

            <div className="mt-5 rounded-2xl border border-border-low bg-bg-soft p-4 sm:mt-6 sm:p-5">
                {totals && (totals.org > 0 || totals.delivery > 0) && (
                    <div className="flex flex-col gap-1.5 text-14-medium text-fg-secondary tabular-nums">
                        <div className="flex items-baseline justify-between gap-4">
                            <span>Стоимость выбранных товаров</span>
                            <span>{formatPriceRub(totals.base)}</span>
                        </div>
                        {totals.org > 0 && (
                            <div className="flex items-baseline justify-between gap-4">
                                <span>Оргсбор</span>
                                <span>{formatPriceRub(totals.org)}</span>
                            </div>
                        )}
                        {totals.delivery > 0 && (
                            <div className="flex items-baseline justify-between gap-4">
                                <span>Доставка</span>
                                <span>{formatPriceRub(totals.delivery)}</span>
                            </div>
                        )}
                    </div>
                )}
                <div
                    className={cn(
                        'flex items-baseline justify-between gap-4',
                        totals && (totals.org > 0 || totals.delivery > 0)
                            ? 'mt-3 border-t border-border-low pt-3'
                            : '',
                    )}
                >
                    <span className="text-13-semibold uppercase tracking-wide text-fg-secondary sm:text-14-semibold">
                        Итоговая сумма
                    </span>
                    <span className="text-20-semibold text-primary tabular-nums sm:text-24-semibold">
                        {formatRub(group.total)}
                    </span>
                </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:gap-4">
                {(handoffStatus === 'READY_TO_SHIP' || handoffStatus === 'STORED') && (
                    <HandoffMessageCard status={handoffStatus} />
                )}

                {purchasePayments.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-11-medium uppercase tracking-wide text-fg-tertiary">Ваши оплаты</p>
                        {purchasePayments.map((p, idx) => (
                            <MyPaymentRow key={(p as any).id ?? idx} payment={p as unknown as ShopPaymentView} />
                        ))}
                    </div>
                )}

                {handoffStatus === 'ASSEMBLED' && group.orderNumber != null && (
                    <div className="rounded-2xl border-2 border-gold/70 bg-bg-card/70 p-4">
                        <p className="flex items-center gap-2 text-14-semibold text-fg-primary">
                            <Boxes className="size-4 shrink-0 text-primary" />
                            Ваш заказ собран
                        </p>
                        <p className="mt-1 text-13-regular text-fg-secondary">
                            Отправляем заказ сейчас или пока оставим его на хранение?
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Button
                                variant="brand"
                                size="sm"
                                className="flex-1"
                                disabled={handoffChoice.isPending}
                                onClick={() =>
                                    handoffChoice.mutate({
                                        purchaseOrderId: group.orderNumber!,
                                        choice: 'READY_TO_SHIP',
                                    })
                                }
                            >
                                <Send className="size-3.5" />
                                Отправить заказ
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                disabled={handoffChoice.isPending}
                                onClick={() =>
                                    handoffChoice.mutate({
                                        purchaseOrderId: group.orderNumber!,
                                        choice: 'STORED',
                                    })
                                }
                            >
                                <Archive className="size-3.5" />
                                Оставить на хранение
                            </Button>
                        </div>
                    </div>
                )}

                <PaymentStatusBlock
                    total={group.total}
                    remaining={remaining}
                    hasPending={hasPending}
                    isFullyPaid={isFullyPaid}
                    isPast={isPast}
                    paymentOpen={paymentOpen}
                    purchaseId={group.id}
                    orderCount={group.orders.length}
                />
            </div>
        </section>
    );
}

export default function OrdersPage() {
    const router = useAppRouter();
    const [tab, setTab] = useState<OrdersTab>('active');
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    const { activeGroups, pastGroups } = useMemo(() => {
        const all = groupOrdersByPurchase((myOrders ?? []) as any);
        return {
            activeGroups: all.filter((g) => !isPurchaseCompleted(g.status)),
            pastGroups: all.filter((g) => isPurchaseCompleted(g.status)),
        };
    }, [myOrders]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 sm:gap-8">
                <Skeleton className="h-9 w-56 rounded-2xl sm:h-12 sm:w-72" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-10 w-72 rounded-full" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                ))}
            </div>
        );
    }

    if (!myOrders?.length) {
        return (
            <div className="flex flex-col gap-5 sm:gap-8">
                <h1 className="text-h1 text-center text-secondary sm:text-left">Мои заказы</h1>
                <div className="rounded-[10px] bg-bg-soft sm:rounded-[20px]">
                    <EmptyState
                        variant="plain"
                        icon={ClipboardList}
                        title="Пока нет заказов"
                        description="Перейдите в закупку, чтобы заказать товары"
                        actionLabel="К закупкам"
                        onAction={() => router.push('/shop')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 sm:gap-8">
            <h1 className="text-h1 text-center text-secondary sm:text-left">Мои заказы</h1>

            <div className="rounded-[10px] bg-bg-soft p-4 sm:rounded-[20px] sm:p-6">
                <OrdersSegmentedTabs
                    tab={tab}
                    onTabChange={setTab}
                    activeCount={activeGroups.length}
                    pastCount={pastGroups.length}
                />

                {tab === 'active' ? (
                    <div className="mt-5 sm:mt-12">
                        {activeGroups.length === 0 ? (
                            <OrdersEmptyState
                                title="Нет активных заказов"
                                description="Здесь закупки, в которых вы ещё можете заказывать или оплачивать."
                                showShopLink
                            />
                        ) : (
                            <div className="divide-y divide-border-low">
                                {activeGroups.map((group) => (
                                    <PurchaseOrderCard
                                        key={group.id}
                                        group={group}
                                        myPayments={myPayments}
                                        isPast={false}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-5 sm:mt-12">
                        {pastGroups.length === 0 ? (
                            <OrdersEmptyState
                                title="Нет прошлых заказов"
                                description="Сюда попадают заказы из завершённых закупок."
                            />
                        ) : (
                            <div className="divide-y divide-border-low">
                                {pastGroups.map((group) => (
                                    <PurchaseOrderCard key={group.id} group={group} myPayments={myPayments} isPast />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
