'use client';

import { trpc } from '@/lib/client/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AppLink } from '@/components/app-link';
import { ShoppingCart, Trash2, ArrowRight, CircleCheck, Clock, CreditCard } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { CartLineQuantityControls } from '@/components/shop/cart-line-quantity-controls';
import { PurchasePaymentDialog } from '@/components/shop/purchase-payment-dialog';
import { MyPaymentRow } from '@/components/shop/my-payment-row';
import { summarizePurchasePayments, type ShopPaymentView } from '@/components/shop/payment-proof';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';
import { PURCHASE_FULFILLMENT_LABELS, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';

export default function CartPage() {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();
    const deleteOrder = trpc.orders.deleteOrder.useMutation();

    // Group orders by purchase
    const grouped = new Map<
        number,
        {
            id: number;
            tag: string;
            supplier: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orders: any[];
            total: number;
            fulfillmentStatus: string | null;
        }
    >();

    if (myOrders) {
        for (const order of myOrders) {
            const purchase = (order as any).purchaseItem?.purchase;
            if (!purchase) continue;
            const pid = purchase.id as number;
            if (!grouped.has(pid)) {
                grouped.set(pid, {
                    id: pid,
                    tag: purchase.tag,
                    supplier: purchase.supplier,
                    orders: [],
                    total: 0,
                    fulfillmentStatus: (purchase as any).fulfillmentStatus ?? null,
                });
            }
            const group = grouped.get(pid)!;
            group.orders.push(order);
            group.total += Number(order.amountDue);
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <Skeleton key={j} className="h-16 w-full" />
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
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                <h2 className="mt-4 text-lg font-medium">Корзина пуста</h2>
                <p className="mt-1 text-sm text-muted-foreground">Вы ещё ничего не заказали</p>
                <Button className="mt-4" onClick={() => router.push('/shop')}>
                    К закупкам
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        );
    }

    const groups = Array.from(grouped.values());

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Корзина</h1>

            {groups.map((group) => {
                const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
                const paymentSummary = summarizePurchasePayments(group.total, purchasePayments);
                const { confirmedPaid: totalPaid, remaining, hasPending, isFullyPaid } = paymentSummary;
                const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];
                const paymentOpen = isPurchasePaymentOpen(fs);

                return (
                    <Card key={group.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <AppLink href={`/shop/purchase/${group.id}`}>
                                    <CardTitle className="text-lg hover:text-primary transition-colors">
                                        {group.supplier}
                                    </CardTitle>
                                </AppLink>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-normal">
                                        {group.tag}
                                    </Badge>
                                    <Badge variant="outline" className="font-normal">
                                        {fulfillmentLabel}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-0">
                            {group.orders.map((order, idx) => {
                                const purchaseItem = (
                                    order as {
                                        purchaseItem?: {
                                            id: number;
                                            minQty: unknown;
                                            product?: ProductLabelSource & {
                                                photos: { id: number }[];
                                                unit: { shortName: string; multiplicity: string | number } | null;
                                                minPackageAmount: string | number | null;
                                                minPackageUnit: string | null;
                                            };
                                        };
                                    }
                                ).purchaseItem;
                                const product = purchaseItem?.product;
                                const shortName = product?.unit?.shortName ?? 'ед.';
                                const photo = product?.photos?.[0];
                                const qty = Number(order.quantity);
                                const amount = Number(order.amountDue);

                                return (
                                    <div key={order.id}>
                                        {idx > 0 && <Separator />}
                                        <div className="flex items-start gap-3 py-3">
                                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                                {photo ? (
                                                    <img
                                                        src={absoluteProductPhotoUrl(photo.id)}
                                                        alt={product?.name ?? ''}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center">
                                                        <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                {product && (
                                                    <PurchaseProductLabel
                                                        product={product}
                                                        omitArticle
                                                        primaryClassName="text-sm font-medium leading-snug line-clamp-2"
                                                        secondaryClassName="text-xs text-muted-foreground line-clamp-2"
                                                    />
                                                )}
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {amount.toLocaleString('ru-RU')} ₽
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                {purchaseItem && product?.unit && (
                                                    <CartLineQuantityControls
                                                        orderId={order.id}
                                                        purchaseItemId={purchaseItem.id}
                                                        purchaseId={group.id}
                                                        quantity={qty}
                                                        unitShort={shortName}
                                                        multiplicity={Number(product.unit.multiplicity)}
                                                        minPackageAmount={
                                                            product.minPackageAmount != null
                                                                ? Number(product.minPackageAmount)
                                                                : null
                                                        }
                                                        minPackageUnit={product.minPackageUnit}
                                                        purchaseItemMinQty={
                                                            purchaseItem.minQty != null
                                                                ? Number(purchaseItem.minQty)
                                                                : null
                                                        }
                                                    />
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    disabled={deleteOrder.isPending}
                                                    onClick={() => {
                                                        deleteOrder.mutate(
                                                            { id: order.id },
                                                            { onSuccess: () => utils.orders.getMyOrders.invalidate() },
                                                        );
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <Separator />

                            {/* Payment summary */}
                            <div className="rounded-xl border mt-3 p-4 space-y-3">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">К оплате</p>
                                        <p className="text-lg font-bold">{group.total.toLocaleString('ru-RU')} ₽</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Покрыто</p>
                                        <p className="text-lg font-bold text-success">
                                            {totalPaid.toLocaleString('ru-RU')} ₽
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Осталось</p>
                                        <p
                                            className={cn(
                                                'text-lg font-bold',
                                                remaining > 0 ? 'text-warning' : 'text-success',
                                            )}
                                        >
                                            {remaining.toLocaleString('ru-RU')} ₽
                                        </p>
                                    </div>
                                </div>

                                {/* Payments list */}
                                {purchasePayments.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t">
                                        {purchasePayments.map((p) => (
                                            <MyPaymentRow key={p.id} payment={p as ShopPaymentView} />
                                        ))}
                                    </div>
                                )}

                                {/* Status / Pay button */}
                                {isFullyPaid ? (
                                    <div className="flex items-center justify-center gap-2 rounded-lg bg-success-50 py-2 text-success">
                                        <CircleCheck className="h-4 w-4" />
                                        <span className="text-sm font-medium">Полностью оплачено</span>
                                    </div>
                                ) : hasPending ? (
                                    <div className="flex items-center justify-center gap-2 rounded-lg bg-warning/10 py-2 text-warning">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-sm font-medium">Ожидает подтверждения оплаты</span>
                                    </div>
                                ) : paymentOpen && remaining > 0 ? (
                                    <PurchasePaymentDialog
                                        purchaseId={group.id}
                                        remaining={remaining}
                                        hasPending={hasPending}
                                        paymentOpen={paymentOpen}
                                        buttonSize="default"
                                    />
                                ) : remaining > 0 ? (
                                    <div className="flex items-center justify-center gap-2 rounded-lg bg-muted py-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-sm font-medium">Ждём начала оплаты</span>
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <span className="text-muted-foreground">
                    Всего {myOrders.length}{' '}
                    {myOrders.length === 1 ? 'позиция' : myOrders.length < 5 ? 'позиции' : 'позиций'}
                </span>
                <span className="text-lg font-bold">
                    {myOrders.reduce((sum, o) => sum + Number(o.amountDue), 0).toLocaleString('ru-RU')} ₽
                </span>
            </div>
        </div>
    );
}
