'use client';

import {
    HANDOFF_STATUS_LABELS,
    type HandoffStatus,
    isOrderingClosedStage,
    isPurchaseCompleted,
    isPurchasePaymentOpen,
    isSupplementPhase,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
} from '@zakupki/types';
import { Archive, Boxes, CircleCheck, ClipboardList, Clock, CreditCard, PackageCheck, Send, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useHandoffChoice } from '@/app/shop/hooks/use-handoff-choice';
import { useOnlinePaymentSync, usePaymentReturnToast } from '@/app/shop/hooks/use-online-payment-sync';
import { groupPaymentState, summarizeAwaitingPayment } from '@/app/shop/lib/awaiting-payment';
import { linePriceBreakdown } from '@/app/shop/lib/cart-display';
import { type GroupableOrderLine, groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { CartLine } from '@/app/shop/orders/components/cart-line';
import { HandoffMessageCard } from '@/app/shop/orders/components/handoff-message-card';
import { MyPaymentRow } from '@/app/shop/orders/components/my-payment-row';
import { PaymentStatusBlock } from '@/app/shop/orders/components/payment-status-block';
import { AppLink } from '@/components/app-link';
import { AppBackButton } from '@/components/shop/app-back-button';
import { isLiveAwaiting, type ShopPaymentView, summarizePurchasePayments } from '@/components/shop/payment-proof';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { formatPriceRub, formatRub } from '@/lib/format/money';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { findPinnedPromo } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

type OrdersTab = 'active' | 'past';

function stageHint(fs: PurchaseFulfillmentStatus): string {
    if (isOrderingClosedStage(fs)) return 'Состав заказа закрыт';
    if (isPurchasePaymentOpen(fs)) return 'Можно добавлять только остатки до полной пачки';
    if (isSupplementPhase(fs)) return 'Идут доборы — можно добрать остатки';
    return 'Состав заказа можно менять';
}

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
    myPayments:
        | { id: number; purchaseId: number; status: string; amount: unknown; children?: { amount: unknown }[] }[]
        | undefined;
    isPast: boolean;
}) {
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const purchaseStatus = group.status as PurchaseStatus;
    const completed = isPurchaseCompleted(purchaseStatus);
    const editable = !isPast && !completed && !isOrderingClosedStage(fs);

    const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
    const paymentSummary = summarizePurchasePayments(group.total, purchasePayments);
    const { remaining, available, hasPending, isFullyPaid } = paymentSummary;
    const pinnedPromo = findPinnedPromo(purchasePayments);
    const paymentOpen = !completed && isPurchasePaymentOpen(fs);

    const breakdowns = group.orders.map((order) => linePriceBreakdown(order));
    const totals =
        breakdowns.length > 0 && breakdowns.every((b) => b != null)
            ? breakdowns.reduce(
                  (acc, b) => ({
                      base: acc.base + b!.baseRub,
                      org: acc.org + b!.orgFeeRub,
                      delivery: acc.delivery + b!.deliveryRub,
                  }),
                  { base: 0, org: 0, delivery: 0 },
              )
            : null;

    const paymentState = groupPaymentState(group, purchasePayments);
    const itemCount = group.orders.filter((o) => o.quantity > 0 || o.packageCount > 0).length;

    const handoffChoice = useHandoffChoice();
    const handoffStatus = (group.handoffStatus ?? null) as HandoffStatus | null;

    return (
        <section
            id={`purchase-${group.id}`}
            className="scroll-mt-20 overflow-hidden rounded-2xl border border-border-low bg-bg-card shadow-sm sm:rounded-3xl"
        >
            <div className="flex items-start justify-between gap-3 border-b border-border-low bg-bg-soft px-4 py-4 sm:px-6 sm:py-5">
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
                    {!isPast && (
                        <p className="mt-1 text-12-regular text-fg-tertiary sm:text-13-regular">{stageHint(fs)}</p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-18-semibold text-fg-primary tabular-nums sm:text-20-semibold">
                        {formatRub(group.total)}
                    </span>
                    <span className="text-12-regular text-fg-tertiary">
                        {itemCount} {pluralItems(itemCount)}
                    </span>
                    <GroupPaymentChip state={paymentState} isPast={isPast} />
                    {handoffStatus && <HandoffPill status={handoffStatus} />}
                </div>
            </div>

            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="mt-1 divide-y divide-border-low">
                    {group.orders.map((order) => (
                        <CartLine key={order.purchaseItemId} group={group} order={order} editable={editable} />
                    ))}
                </div>

                <div className="mt-4 rounded-2xl border border-border-low bg-bg-soft p-4 sm:p-5">
                    {totals && (totals.org > 0 || totals.delivery > 0) && (
                        <div className="flex flex-col gap-1.5 text-14-medium text-fg-secondary tabular-nums">
                            <div className="flex items-baseline justify-between gap-4">
                                <span>Стоимость выбранных товаров</span>
                                <span className="whitespace-nowrap">{formatPriceRub(totals.base)}</span>
                            </div>
                            {totals.org > 0 && (
                                <div className="flex items-baseline justify-between gap-4">
                                    <span>Оргсбор</span>
                                    <span className="whitespace-nowrap">{formatPriceRub(totals.org)}</span>
                                </div>
                            )}
                            {totals.delivery > 0 && (
                                <div className="flex items-baseline justify-between gap-4">
                                    <span>Доставка</span>
                                    <span className="whitespace-nowrap">{formatPriceRub(totals.delivery)}</span>
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
                        <span className="whitespace-nowrap text-20-semibold text-primary tabular-nums sm:text-24-semibold">
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
                            {purchasePayments.map((p) => (
                                <MyPaymentRow key={p.id} payment={p as unknown as ShopPaymentView} />
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
                                    className="w-full sm:flex-1 sm:w-auto"
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
                                    className="w-full sm:flex-1 sm:w-auto"
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
                        available={available}
                        hasPending={hasPending}
                        isFullyPaid={isFullyPaid}
                        isPast={isPast}
                        paymentOpen={paymentOpen}
                        purchaseId={group.id}
                        pinnedPromo={pinnedPromo}
                        orderCount={group.orders.length}
                        awaitingPayment={findAwaitingPayment(purchasePayments as unknown as ShopPaymentView[])}
                    />
                </div>
            </div>
        </section>
    );
}

/** Последняя неоплаченная онлайн-оплата с живой ссылкой — её предлагаем продолжить. */
function findAwaitingPayment(payments: ShopPaymentView[]): { paymentUrl: string; total: number } | undefined {
    const awaiting = payments.find((p) => p.paymentUrl && isLiveAwaiting(p));
    if (!awaiting?.paymentUrl) return undefined;
    return { paymentUrl: awaiting.paymentUrl, total: Number(awaiting.amount) + Number(awaiting.feeAmount ?? 0) };
}

export default function OrdersPage() {
    const router = useAppRouter();
    const [tab, setTab] = useState<OrdersTab>('active');
    // Возврат, подтверждение оплаты или пересчёт делает админ — когда клиент возвращается
    // на вкладку, подтягиваем свежие данные, иначе он видел старый список оплат без возврата.
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery(undefined, { refetchOnWindowFocus: true });
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery(undefined, { refetchOnWindowFocus: true });
    useOnlinePaymentSync((myPayments ?? []).some((p) => isLiveAwaiting(p)));
    usePaymentReturnToast();

    const { activeGroups, pastGroups } = useMemo(() => {
        const all = groupOrdersByPurchase((myOrders ?? []) as unknown as GroupableOrderLine[]);
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
                <AppBackButton fallbackHref="/shop" label="Назад" />
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
            <div className="flex flex-col gap-3 sm:gap-4">
                <AppBackButton fallbackHref="/shop" label="Назад" />
                <h1 className="text-h1 text-center text-secondary sm:text-left">Мои заказы</h1>
            </div>

            <div>
                <OrdersSegmentedTabs
                    tab={tab}
                    onTabChange={setTab}
                    activeCount={activeGroups.length}
                    pastCount={pastGroups.length}
                />

                {tab === 'active' ? (
                    <div className="mt-5 sm:mt-8">
                        {activeGroups.length === 0 ? (
                            <OrdersEmptyState
                                title="Нет активных заказов"
                                description="Здесь закупки, в которых вы ещё можете заказывать или оплачивать."
                                showShopLink
                            />
                        ) : (
                            <div className="flex flex-col gap-4 sm:gap-6">
                                <AwaitingPaymentBanner groups={activeGroups} myPayments={myPayments} />
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
                    <div className="mt-5 sm:mt-8">
                        {pastGroups.length === 0 ? (
                            <OrdersEmptyState
                                title="Нет прошлых заказов"
                                description="Сюда попадают заказы из завершённых закупок."
                            />
                        ) : (
                            <div className="flex flex-col gap-4 sm:gap-6">
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

function pluralItems(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'товар';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара';
    return 'товаров';
}

function GroupPaymentChip({ state, isPast }: { state: ReturnType<typeof groupPaymentState>; isPast: boolean }) {
    const base = 'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-12-medium';
    if (state.isFullyPaid) {
        return (
            <span className={cn(base, 'border-success/40 bg-success/10 text-success')}>
                <CircleCheck className="size-3" />
                Оплачено
            </span>
        );
    }
    if (state.hasPending && state.toPay <= 0.009) {
        return (
            <span className={cn(base, 'border-warning/40 bg-warning/10 text-warning')}>
                <Clock className="size-3" />
                Оплата на проверке
            </span>
        );
    }
    if (state.awaiting && !isPast) {
        return (
            <span className={cn(base, 'border-primary/40 bg-primary/10 text-primary tabular-nums')}>
                <CreditCard className="size-3" />К оплате {formatRub(state.toPay)}
            </span>
        );
    }
    return null;
}

/** Сводка сверху: сколько товаров и в каких закупках ждут оплаты, со ссылками на карточки. */
function AwaitingPaymentBanner({
    groups,
    myPayments,
}: {
    groups: OrderPurchaseGroup[];
    myPayments: Parameters<typeof summarizeAwaitingPayment>[1] | undefined;
}) {
    if (!myPayments) return null;
    const summary = summarizeAwaitingPayment(groups, myPayments);
    if (summary.items === 0) return null;
    const awaitingGroups = groups.filter((g) => groupPaymentState(g, myPayments).awaiting);
    return (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-14-semibold text-fg-primary sm:text-16-semibold">
                <CreditCard className="size-4 shrink-0 text-primary" />
                Ждут оплаты: {summary.items} {pluralItems(summary.items)} на {formatRub(summary.amount)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                {awaitingGroups.map((g) => (
                    <a
                        key={g.id}
                        href={`#purchase-${g.id}`}
                        className={cn(
                            'inline-flex h-8 items-center gap-2 rounded-full border border-border-low bg-bg-card px-3',
                            'text-13-medium text-fg-primary transition-colors hover:border-primary/50',
                        )}
                    >
                        <span className="text-secondary">{g.tag}</span>
                        <span className="tabular-nums text-primary">
                            {formatRub(groupPaymentState(g, myPayments).toPay)}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}
