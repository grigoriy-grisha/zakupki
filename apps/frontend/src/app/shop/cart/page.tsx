'use client';

import { trpc } from '@/lib/client/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AppLink } from '@/components/app-link';
import { ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchasePaymentDialog } from '@/components/shop/purchase-payment-dialog';
import { MyPaymentRow } from '@/components/shop/my-payment-row';
import { summarizePurchasePayments, type ShopPaymentView } from '@/components/shop/payment-proof';
import { PaymentStatusBlock } from '@/components/shop/payment-status-block';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import { PURCHASE_FULFILLMENT_LABELS, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { toast } from 'sonner';

export default function CartPage() {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery();
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery();

    // Используем adjustQuantity вместо deleteOrder — service сам делает zero-out/hard delete
    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
        },
        onError: (err) => toast.error(err.message),
    });

    const groups = groupOrdersByPurchase((myOrders ?? []) as any);

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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Корзина</h1>

            {groups.map((group: OrderPurchaseGroup) => {
                const purchasePayments = myPayments?.filter((p: any) => p.purchaseId === group.id) ?? [];
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
                            {group.orders.map((order, idx: number) => {
                                const product:
                                    | (ProductLabelSource & {
                                          photos: { id: number }[];
                                          unit: { shortName: string; multiplicity: string | number } | null;
                                      })
                                    | undefined = order.source.purchaseItem?.product;
                                const shortName = product?.unit?.shortName ?? 'ед.';
                                const photo = product?.photos?.[0];
                                const qty = order.quantity;
                                const amount = order.amountDue;
                                const purchaseItemId = order.purchaseItemId;

                                return (
                                    <div key={order.purchaseItemId}>
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
                                                    {qty} {shortName} · {amount.toLocaleString('ru-RU')} ₽
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    disabled={adjustMutation.isPending}
                                                    onClick={() => {
                                                        // adjustQuantity с -qty → service делает zero-out на REORDER+ или hard delete на COLLECTION
                                                        adjustMutation.mutate({
                                                            purchaseItemId,
                                                            delta: -qty,
                                                        });
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
                                            className={`text-lg font-bold ${
                                                remaining > 0 ? 'text-warning' : 'text-success'
                                            }`}
                                        >
                                            {remaining.toLocaleString('ru-RU')} ₽
                                        </p>
                                    </div>
                                </div>

                                {purchasePayments.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t">
                                        {purchasePayments.map((p: any) => (
                                            <MyPaymentRow key={p.id} payment={p as ShopPaymentView} />
                                        ))}
                                    </div>
                                )}

                                {isFullyPaid ? (
                                    <PaymentStatusBlock
                                        total={group.total}
                                        remaining={remaining}
                                        hasPending={hasPending}
                                        isFullyPaid={isFullyPaid}
                                        paymentOpen={paymentOpen}
                                        purchaseId={group.id}
                                    />
                                ) : hasPending ? (
                                    <PaymentStatusBlock
                                        total={group.total}
                                        remaining={remaining}
                                        hasPending={hasPending}
                                        isFullyPaid={isFullyPaid}
                                        paymentOpen={paymentOpen}
                                        purchaseId={group.id}
                                    />
                                ) : paymentOpen && remaining > 0 ? (
                                    <PurchasePaymentDialog
                                        purchaseId={group.id}
                                        remaining={remaining}
                                        hasPending={hasPending}
                                        paymentOpen={paymentOpen}
                                        buttonSize="default"
                                    />
                                ) : remaining > 0 ? (
                                    <PaymentStatusBlock
                                        total={group.total}
                                        remaining={remaining}
                                        hasPending={hasPending}
                                        isFullyPaid={isFullyPaid}
                                        paymentOpen={false}
                                        purchaseId={group.id}
                                    />
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
