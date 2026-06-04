'use client';

import { trpc } from '@/lib/client/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { ClipboardList, ShoppingCart, ArrowRight, CircleCheck, Clock, CreditCard } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import {
    PURCHASE_FULFILLMENT_LABELS,
    isPurchasePaymentOpen,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';

export default function OrdersPage() {
    const router = useAppRouter();
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
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
                <p className="mt-1 text-sm text-muted-foreground">
                    Перейдите в закупку, чтобы заказать товары
                </p>
                <Button className="mt-4" onClick={() => router.push('/shop')}>
                    К закупкам
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        );
    }

    // Group by purchase
    const grouped = new Map<number, {
        id: number;
        tag: string;
        supplier: string;
        fulfillmentStatus: string | null;
        orders: typeof myOrders;
    }>();

    for (const order of myOrders) {
        const purchase = (order as any).purchaseItem?.purchase;
        if (!purchase) continue;
        const pid = purchase.id as number;
        if (!grouped.has(pid)) {
            grouped.set(pid, {
                id: pid,
                tag: purchase.tag,
                supplier: purchase.supplier,
                fulfillmentStatus: (purchase as any).fulfillmentStatus ?? null,
                orders: [],
            });
        }
        grouped.get(pid)!.orders.push(order);
    }

    const groups = Array.from(grouped.values());

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Мои заказы</h1>

            {groups.map((group) => {
                const total = group.orders.reduce((s, o) => s + Number(o.amountDue), 0);
                const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];

                const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
                const totalPaid = purchasePayments
                    .filter((p) => {
                        const s = (p as { status: string }).status;
                        return s === 'CONFIRMED' || s === 'PENDING';
                    })
                    .reduce((sum, p) => {
                        const children = (p as { children?: { amount: unknown }[] }).children ?? [];
                        const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
                        return sum + Number(p.amount) + childAmount;
                    }, 0);
                const remaining = Math.max(0, total - totalPaid);
                const hasPending = purchasePayments.some((p) => (p as { status: string }).status === 'PENDING');
                const paymentOpen = isPurchasePaymentOpen(fs);
                const isFullyPaid = remaining <= 0 && purchasePayments.length > 0;

                return (
                    <Card key={group.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <AppLink href={`/shop/purchase/${group.id}`}>
                                    <CardTitle className="text-lg hover:text-primary transition-colors">
                                        {group.tag}
                                    </CardTitle>
                                </AppLink>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-normal">{group.supplier}</Badge>
                                    <Badge variant="outline" className="font-normal">{fulfillmentLabel}</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-0">
                            {group.orders.map((order, idx) => {
                                const product = (order as any).purchaseItem?.product as
                                    (ProductLabelSource & { photos: { id: number }[]; unit: { shortName: string } | null }) | undefined;
                                const shortName = product?.unit?.shortName ?? '';
                                const photo = product?.photos?.[0];
                                const qty = Number(order.quantity);
                                const amount = Number(order.amountDue);

                                return (
                                    <div key={order.id}>
                                        {idx > 0 && <Separator />}
                                        <div className="flex items-center gap-3 py-3">
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
                                                    <PurchaseProductLabel product={product} className="text-sm font-medium" />
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="text-muted-foreground/60">#{order.id}</span> · {qty} {shortName} · {amount.toLocaleString('ru-RU')} ₽
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <Separator />

                            {/* Payment status */}
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
                                ) : remaining > 0 && paymentOpen ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <span>
                                                К оплате: <span className="font-medium text-foreground">{remaining.toLocaleString('ru-RU')} ₽</span>
                                            </span>
                                        </div>
                                        <AppLink href={`/shop/purchase/${group.id}`}>
                                            <button className="flex items-center gap-1 font-medium text-primary hover:underline">
                                                <CreditCard className="h-3.5 w-3.5" />
                                                Оплатить
                                            </button>
                                        </AppLink>
                                    </div>
                                ) : paymentOpen ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">
                                            Итого: <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
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
                                            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground/50 cursor-not-allowed"
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
            })}
        </div>
    );
}
