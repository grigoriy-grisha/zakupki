'use client';

import { useMemo } from 'react';
import { Archive, ChevronRight, CircleCheck, ClipboardList, Package, Truck } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '@/components/app-link';
import { EmptyState } from '@/components/ui/empty-state';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/lib/product-label';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { MyPaymentRow } from '@/components/shop/my-payment-row';
import { summarizePurchasePayments, type ShopPaymentView } from '@/components/shop/payment-proof';
import { PaymentStatusBlock } from '@/components/shop/payment-status-block';
import { groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import {
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_STATUS_LABELS,
    HANDOFF_STATUS_LABELS,
    isPurchaseCompleted,
    isPurchasePaymentOpen,
    getUnitByCode,
    type HandoffStatus,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
} from '@zakupki/types';
import { cn } from '@/lib/utils';

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
        <div className="rounded-2xl border border-border bg-bg-card">
            <EmptyState
                icon={ClipboardList}
                title={title}
                description={description}
                actionLabel={showShopLink ? 'К закупкам' : undefined}
                onAction={showShopLink ? () => router.push('/shop') : undefined}
            />
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
        | { purchaseId: number; status: string; amount: unknown; children?: { amount: unknown }[] }[]
        | undefined;
    isPast: boolean;
}) {
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];
    const purchaseStatus = group.status as PurchaseStatus;
    const completed = isPurchaseCompleted(purchaseStatus);
    const handoff = group.handoffStatus as HandoffStatus | null | undefined;

    const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
    const paymentSummary = summarizePurchasePayments(group.total, purchasePayments);
    const { remaining, hasPending, isFullyPaid } = paymentSummary;
    const paymentOpen = !completed && isPurchasePaymentOpen(fs);

    return (
        <Card rounded="2xl" className="gap-0 py-0">
            <div
                className={cn(
                    'flex flex-wrap items-start justify-between gap-x-3 gap-y-2',
                    'border-b border-border-soft px-4 py-3.5 sm:px-5',
                )}
            >
                <div className="min-w-0">
                    {group.orderNumber != null && (
                        <p className="text-12-regular tabular-nums text-fg-tertiary">
                            Заказ №{group.orderNumber}
                        </p>
                    )}
                    <AppLink href={`/shop/purchase/${group.id}`} className="group/title mt-0.5 inline-block">
                        <h3
                            className={cn(
                                'text-16-semibold leading-tight text-fg-primary transition-colors',
                                'group-hover/title:text-primary sm:text-18-semibold',
                            )}
                        >
                            {group.tag}
                        </h3>
                    </AppLink>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {handoff != null && (
                        <Badge
                            type="subtle"
                            variant={handoff === 'RECEIVED' ? 'success' : handoff === 'SENT' ? 'accent' : 'warning'}
                        >
                            {handoff === 'RECEIVED' && <CircleCheck className="size-3" />}
                            {handoff === 'SENT' && <Truck className="size-3" />}
                            {handoff === 'STORED' && <Archive className="size-3" />}
                            {HANDOFF_STATUS_LABELS[handoff]}
                        </Badge>
                    )}
                    {completed ? (
                        <Badge type="subtle" variant="neutral">
                            {PURCHASE_STATUS_LABELS.DONE}
                        </Badge>
                    ) : (
                        <Badge type="subtle" variant="accent">
                            {fulfillmentLabel}
                        </Badge>
                    )}
                </div>
            </div>

            <div className="divide-y divide-border-soft px-1.5 py-1.5 sm:px-2">
                {group.orders.map((order) => {
                    const product:
                        | (ProductLabelSource & { photos: { id: number }[]; unitCode: string })
                        | undefined = order.source.purchaseItem?.product;
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
                                'group flex items-center gap-3 rounded-xl px-2.5 py-2.5',
                                'transition-colors hover:bg-bg-soft',
                            )}
                        >
                            <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-bg-soft">
                                {photo ? (
                                    <img
                                        src={absoluteProductPhotoUrl(photo.id)}
                                        alt={product?.name ?? ''}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-fg-tertiary">
                                        <Package className="size-4" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                {product && (
                                    <PurchaseProductLabel
                                        product={product}
                                        className="min-w-0"
                                        primaryClassName={cn(
                                            'block text-13-medium text-fg-primary transition-colors',
                                            'group-hover:text-primary sm:text-14-medium',
                                        )}
                                        secondaryClassName={cn(
                                            'mt-0.5 block truncate text-11-regular text-fg-tertiary',
                                            'sm:text-12-regular',
                                        )}
                                    />
                                )}
                                <p className="mt-0.5 text-12-regular text-fg-secondary tabular-nums">
                                    {qty} {shortName}
                                    {pkgLabel} · {amount.toLocaleString('ru-RU')} ₽
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

            <div className="flex flex-col gap-2.5 border-t border-border-soft px-4 py-3.5 sm:px-5">
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
        </Card>
    );
}

function OrdersTabCounter({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span
            className={cn(
                'ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full',
                'bg-primary/10 px-1.5 text-11-medium text-primary tabular-nums',
            )}
        >
            {count}
        </span>
    );
}

export default function OrdersPage() {
    const router = useAppRouter();
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
            <div className="flex flex-col gap-5 sm:gap-6">
                <Skeleton className="h-8 w-44 rounded-md" />
                <Skeleton className="h-10 w-84 rounded-full" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} rounded="2xl" className="gap-0 py-0">
                        <div className="flex flex-col gap-2.5 border-b border-border-soft px-4 py-4 sm:px-5">
                            <Skeleton className="h-3.5 w-24 rounded-md" />
                            <Skeleton className="h-6 w-48 rounded-md" />
                        </div>
                        <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <Skeleton key={j} className="h-12 w-full rounded-xl" />
                            ))}
                        </div>
                        <div className="border-t border-border-soft px-4 py-4 sm:px-5">
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    if (!myOrders?.length) {
        return (
            <div className="rounded-2xl border border-border bg-bg-card">
                <EmptyState
                    icon={ClipboardList}
                    title="Пока нет заказов"
                    description="Перейдите в закупку, чтобы заказать товары"
                    actionLabel="К закупкам"
                    onAction={() => router.push('/shop')}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <h1 className="text-24-semibold tracking-tight text-fg-primary sm:text-30-semibold">Мои заказы</h1>

            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active">
                        Активные заказы
                        <OrdersTabCounter count={activeGroups.length} />
                    </TabsTrigger>
                    <TabsTrigger value="past">
                        Прошлые заказы
                        <OrdersTabCounter count={pastGroups.length} />
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 flex flex-col gap-4 sm:mt-5">
                    {activeGroups.length === 0 ? (
                        <OrdersEmptyState
                            title="Нет активных заказов"
                            description="Здесь закупки, в которых вы ещё можете заказывать или оплачивать."
                            showShopLink
                        />
                    ) : (
                        activeGroups.map((group) => (
                            <PurchaseOrderCard key={group.id} group={group} myPayments={myPayments} isPast={false} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="past" className="mt-4 flex flex-col gap-4 sm:mt-5">
                    {pastGroups.length === 0 ? (
                        <OrdersEmptyState
                            title="Нет прошлых заказов"
                            description="Сюда попадают заказы из завершённых закупок."
                        />
                    ) : (
                        pastGroups.map((group) => (
                            <PurchaseOrderCard key={group.id} group={group} myPayments={myPayments} isPast />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
