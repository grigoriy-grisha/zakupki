'use client';

import {
    getUnitByCode,
    isPurchaseCompleted,
    isPurchasePaymentOpen,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
} from '@zakupki/types';
import { ChevronRight, ClipboardList, Package } from 'lucide-react';
import { useMemo, useState } from 'react';

import { groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { MyPaymentRow } from '@/app/shop/orders/components/my-payment-row';
import { PaymentStatusBlock } from '@/app/shop/orders/components/payment-status-block';
import { AppLink } from '@/components/app-link';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { type ShopPaymentView, summarizePurchasePayments } from '@/components/shop/payment-proof';
import { BrandLogo } from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import type { ProductLabelSource } from '@/lib/product-label';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

type OrdersTab = 'active' | 'past';

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
                    'flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4',
                    'text-12-bold transition-colors sm:h-12 sm:px-7 sm:text-16-medium',
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
                    'flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4',
                    'text-12-bold transition-colors sm:h-12 sm:px-7 sm:text-16-medium',
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

    return (
        <section className="py-5 first:pt-0 last:pb-0 sm:py-9">
            <div className="min-w-0">
                {group.orderNumber != null && (
                    <p className="text-14-regular text-fg-secondary tabular-nums sm:text-20-regular">
                        Заказ №{group.orderNumber}
                    </p>
                )}
                <AppLink href={`/shop/purchase/${group.id}`} className="group/title mt-0.5 inline-block">
                    <h3 className="text-h1 text-secondary transition-colors group-hover/title:text-primary">
                        {group.tag}
                    </h3>
                </AppLink>
            </div>

            <div className="mt-5 divide-y divide-border-low sm:mt-8">
                {group.orders.map((order) => {
                    const product: (ProductLabelSource & { photos: { id: number }[]; unitCode: string }) | undefined =
                        order.source.purchaseItem?.product;
                    const shortName = product?.unitCode ? (getUnitByCode(product.unitCode)?.shortName ?? '') : '';
                    const photo = product?.photos?.[0];
                    const qty = order.quantity;
                    const amount = order.amountDue;
                    const pkgLabel = order.packageCount > 0 ? ` + ${order.packageCount} упак.` : '';

                    return (
                        <AppLink
                            key={order.purchaseItemId}
                            href={`/shop/purchase/${group.id}/item/${order.purchaseItemId}`}
                            className={cn(
                                'group flex items-center gap-3 rounded-xl px-1 py-2.5 sm:gap-5 sm:py-3',
                                'transition-colors hover:bg-bg-card/60',
                            )}
                        >
                            <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-bg-card sm:size-[147px] sm:rounded-[20px]">
                                {photo ? (
                                    <img
                                        src={absoluteProductPhotoUrl(photo.id)}
                                        alt={product?.name ?? ''}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-fg-tertiary">
                                        <Package className="size-4 sm:size-6" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                {product && (
                                    <PurchaseProductLabel
                                        product={product}
                                        className="min-w-0"
                                        primaryClassName={cn(
                                            'block font-display text-18-semibold leading-tight text-fg-primary',
                                            'transition-colors group-hover:text-secondary sm:text-30-semibold',
                                        )}
                                        secondaryClassName={cn(
                                            'mt-0.5 block truncate font-display text-14-regular text-fg-secondary',
                                            'sm:mt-1 sm:text-24-regular',
                                        )}
                                    />
                                )}
                                <p className="mt-0.5 font-display text-14-semibold text-fg-primary tabular-nums sm:mt-1 sm:text-24-semibold">
                                    {qty} {shortName}
                                    {pkgLabel} · {formatRub(amount)}
                                </p>
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

            <div className="mt-5 flex flex-col gap-3 sm:mt-9 sm:gap-4">
                <p className="text-right font-display text-24-semibold text-primary sm:text-30-semibold">
                    Итоговая сумма {formatRub(group.total)}
                </p>

                {purchasePayments.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-11-medium uppercase tracking-wide text-fg-tertiary">Ваши оплаты</p>
                        {purchasePayments.map((p, idx) => (
                            <MyPaymentRow key={(p as any).id ?? idx} payment={p as unknown as ShopPaymentView} />
                        ))}
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
                <BrandLogo className="mx-auto w-[124px] text-primary sm:hidden" />
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
            <BrandLogo className="mx-auto w-[124px] text-primary sm:hidden" />
            <h1 className="text-h1 text-center text-secondary sm:text-left">Мои заказы</h1>

            <div className="rounded-[10px] bg-bg-soft p-4 sm:rounded-[20px] sm:p-8">
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
