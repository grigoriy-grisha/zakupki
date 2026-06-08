'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { ClipboardList, ShoppingCart, ArrowRight, CircleCheck, Clock, CreditCard } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { PurchasePaymentDialog } from '@/components/shop/purchase-payment-dialog';
import { MyPaymentRow } from '@/components/shop/my-payment-row';
import { summarizePurchasePayments, type ShopPaymentView } from '@/components/shop/payment-proof';
import {
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_STATUS_LABELS,
    isPurchaseCompleted,
    isPurchasePaymentOpen,
    getUnitByCode,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
} from '@zakupki/types';

type MyOrderLine = {
    id: number;
    purchaseItemId: number;
    quantity: unknown;
    amountDue: unknown;
    purchaseOrderId?: number | null;
    purchaseItem?: {
        product?: ProductLabelSource & {
            photos: { id: number }[];
            unitCode: string;
        };
        purchase?: {
            id: number;
            tag: string;
            supplier: string;
            fulfillmentStatus: string | null;
            status: string;
        };
    };
};

type OrderPurchaseGroup = {
    id: number;
    orderNumber: number | null;
    tag: string;
    supplier: string;
    status: string;
    fulfillmentStatus: string | null;
    orders: MyOrderLine[];
};

function groupOrdersByPurchase(orders: MyOrderLine[]): OrderPurchaseGroup[] {
    const grouped = new Map<number, OrderPurchaseGroup>();

    for (const order of orders) {
        const purchase = order.purchaseItem?.purchase;
        if (!purchase) continue;
        const pid = purchase.id;
        const purchaseOrderId = order.purchaseOrderId ?? null;
        if (!grouped.has(pid)) {
            grouped.set(pid, {
                id: pid,
                orderNumber: purchaseOrderId,
                tag: purchase.tag,
                supplier: purchase.supplier,
                status: purchase.status,
                fulfillmentStatus: purchase.fulfillmentStatus ?? null,
                orders: [],
            });
        }
        const group = grouped.get(pid)!;
        if (group.orderNumber == null && purchaseOrderId != null) {
            group.orderNumber = purchaseOrderId;
        }
        group.orders.push(order);
    }

    return Array.from(grouped.values());
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
            <h2 className="mt-4 text-base font-medium">{title}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
            {showShopLink && (
                <Button className="mt-4" size="sm" onClick={() => router.push('/shop')}>
                    К закупкам
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
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
    const total = group.orders.reduce((s, o) => s + Number(o.amountDue), 0);
    const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];
    const purchaseStatus = group.status as PurchaseStatus;
    const completed = isPurchaseCompleted(purchaseStatus);

    const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
    const paymentSummary = summarizePurchasePayments(total, purchasePayments);
    const { remaining, hasPending, isFullyPaid } = paymentSummary;
    const paymentOpen = !completed && isPurchasePaymentOpen(fs);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {group.orderNumber != null && (
                            <p className="mb-1 text-sm font-medium tabular-nums text-muted-foreground">
                                Заказ №{group.orderNumber}
                            </p>
                        )}
                        <AppLink href={`/shop/purchase/${group.id}`}>
                            <CardTitle className="text-lg hover:text-primary transition-colors">{group.tag}</CardTitle>
                        </AppLink>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Badge variant="outline" className="font-normal">
                            {group.supplier}
                        </Badge>
                        {completed ? (
                            <Badge variant="secondary" className="font-normal">
                                {PURCHASE_STATUS_LABELS.DONE}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="font-normal">
                                {fulfillmentLabel}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-0">
                {group.orders.map((order, idx) => {
                    const product = order.purchaseItem?.product;
                    const shortName = product?.unitCode ? getUnitByCode(product.unitCode)?.shortName ?? '' : '';
                    const photo = product?.photos?.[0];
                    const qty = Number(order.quantity);
                    const amount = Number(order.amountDue);

                    return (
                        <div key={order.id}>
                            {idx > 0 && <Separator />}
                            <AppLink
                                href={`/shop/purchase/${group.id}/item/${order.purchaseItemId}`}
                                className="group flex items-center gap-3 rounded-md py-3 transition-colors hover:bg-accent/50"
                            >
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                    {photo ? (
                                        <img
                                            src={absoluteProductPhotoUrl(photo.id)}
                                            alt={product?.name ?? ''}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    {product && (
                                        <PurchaseProductLabel
                                            product={product}
                                            className="text-sm font-medium group-hover:text-primary"
                                        />
                                    )}
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {qty} {shortName} · {amount.toLocaleString('ru-RU')} ₽
                                    </p>
                                </div>
                            </AppLink>
                        </div>
                    );
                })}

                <Separator />

                {purchasePayments.length > 0 && (
                    <div className="space-y-2 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Ваши оплаты</p>
                        {purchasePayments.map((p, idx) => (
                            <MyPaymentRow key={(p as { id?: number }).id ?? idx} payment={p as unknown as ShopPaymentView} />
                        ))}
                    </div>
                )}

                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    {isFullyPaid ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-success">
                                <CircleCheck className="h-4 w-4" />
                                <span className="font-medium">Оплачено</span>
                            </div>
                            <span className="font-semibold">{total.toLocaleString('ru-RU')} ₽</span>
                        </div>
                    ) : hasPending ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-warning">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Ожидает подтверждения</span>
                            </div>
                            <span className="font-semibold">{total.toLocaleString('ru-RU')} ₽</span>
                        </div>
                    ) : isPast ? (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                Итого:{' '}
                                <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                            </span>
                            {remaining > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    К оплате было {remaining.toLocaleString('ru-RU')} ₽
                                </span>
                            )}
                        </div>
                    ) : remaining > 0 && paymentOpen ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                    К оплате:{' '}
                                    <span className="font-medium text-foreground">
                                        {remaining.toLocaleString('ru-RU')} ₽
                                    </span>
                                </span>
                            </div>
                            <PurchasePaymentDialog
                                purchaseId={group.id}
                                remaining={remaining}
                                hasPending={hasPending}
                                paymentOpen={paymentOpen}
                                triggerVariant="link"
                            />
                        </div>
                    ) : paymentOpen ? (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                Итого:{' '}
                                <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {group.orders.length} {group.orders.length === 1 ? 'позиция' : 'позиции'}
                            </span>
                        </div>
                    ) : (
                        <div>
                            <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                            <button
                                disabled
                                className="mt-1.5 flex w-full cursor-not-allowed items-center justify-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground/50"
                            >
                                <CreditCard className="h-3 w-3" />
                                Ждём начала оплаты
                            </button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function OrdersPage() {
    const router = useAppRouter();
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    const { activeGroups, pastGroups } = useMemo(() => {
        const all = groupOrdersByPurchase((myOrders ?? []) as unknown as MyOrderLine[]);
        return {
            activeGroups: all.filter((g) => !isPurchaseCompleted(g.status)),
            pastGroups: all.filter((g) => isPurchaseCompleted(g.status)),
        };
    }, [myOrders]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-9 w-72" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <Skeleton key={j} className="h-12 w-full" />
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!myOrders?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <ClipboardList className="h-16 w-16 text-muted-foreground/30" />
                <h2 className="mt-4 text-lg font-medium">Пока нет заказов</h2>
                <p className="mt-1 text-sm text-muted-foreground">Перейдите в закупку, чтобы заказать товары</p>
                <Button className="mt-4" onClick={() => router.push('/shop')}>
                    К закупкам
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Мои заказы</h1>

            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active">
                        Активные заказы
                        {activeGroups.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                {activeGroups.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="past">
                        Прошлые заказы
                        {pastGroups.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                {pastGroups.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 space-y-4">
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

                <TabsContent value="past" className="mt-4 space-y-4">
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
