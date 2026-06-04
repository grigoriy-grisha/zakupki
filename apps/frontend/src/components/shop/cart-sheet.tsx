'use client';

import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShoppingCart, Trash2, ArrowRight, CircleCheck, Clock, CreditCard } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { cn } from '@/lib/utils';
import {
    PURCHASE_FULFILLMENT_LABELS,
    isPurchasePaymentOpen,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { useAppRouter } from '@/lib/hooks/use-app-router';

interface CartSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery(undefined, { enabled: open });
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery(undefined, { enabled: open });
    const deleteOrder = trpc.orders.deleteOrder.useMutation();

    // Group by purchase
    const grouped = new Map<number, {
        id: number;
        tag: string;
        supplier: string;
        orders: NonNullable<typeof myOrders>;
        total: number;
        fulfillmentStatus: string | null;
    }>();

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

    const groups = grouped.size > 0 ? Array.from(grouped.values()) : [];
    const grandTotal = myOrders?.reduce((s, o) => s + Number(o.amountDue), 0) ?? 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="px-4 pt-4 pb-2">
                    <SheetTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Корзина
                        {myOrders && myOrders.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{myOrders.length}</Badge>
                        )}
                    </SheetTitle>
                </SheetHeader>

                {!myOrders?.length ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Корзина пуста</p>
                        <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); router.push('/shop'); }}>
                            К закупкам
                            <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                            {groups.map((group) => {
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
                                const remaining = Math.max(0, group.total - totalPaid);
                                const hasPending = purchasePayments.some((p) => (p as { status: string }).status === 'PENDING');
                                const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
                                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];
                                const paymentOpen = isPurchasePaymentOpen(fs);
                                const isFullyPaid = remaining <= 0 && purchasePayments.length > 0;

                                return (
                                    <div key={group.id}>
                                        <div className="flex items-center justify-between mb-2">
                                            <button
                                                onClick={() => { onOpenChange(false); router.push(`/shop/purchase/${group.id}`); }}
                                                className="font-semibold text-sm hover:text-primary transition-colors text-left"
                                            >
                                                {group.supplier}
                                            </button>
                                            <Badge variant="outline" className="text-xs font-normal">{group.tag}</Badge>
                                        </div>

                                        {group.orders.map((order) => {
                                            const product = (order as any).purchaseItem?.product as
                                                (ProductLabelSource & { photos: { id: number }[]; unit: { shortName: string } | null }) | undefined;
                                            const shortName = product?.unit?.shortName ?? '';
                                            const photo = product?.photos?.[0];
                                            const qty = Number(order.quantity);
                                            const amount = Number(order.amountDue);

                                            return (
                                                <div key={order.id} className="flex items-center gap-2 py-2">
                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                                        {photo ? (
                                                            <img src={absoluteProductPhotoUrl(photo.id)} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center">
                                                                <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        {product && (
                                                            <PurchaseProductLabel product={product} as="span" className="text-sm truncate" />
                                                        )}
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="text-muted-foreground/60">#{order.id}</span> · {qty} {shortName} · {amount.toLocaleString('ru-RU')} ₽
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="shrink-0 text-muted-foreground hover:text-destructive"
                                                        disabled={deleteOrder.isPending}
                                                        onClick={() => {
                                                            deleteOrder.mutate(
                                                                { id: order.id },
                                                                { onSuccess: () => utils.orders.getMyOrders.invalidate() },
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            );
                                        })}

                                        {/* Payment status */}
                                        <div className="mt-1 rounded-lg bg-muted/50 p-2 text-xs">
                                            {isFullyPaid ? (
                                                <div className="flex items-center gap-1 text-success">
                                                    <CircleCheck className="h-3.5 w-3.5" />
                                                    <span className="font-medium">Оплачено</span>
                                                </div>
                                            ) : hasPending ? (
                                                <div className="flex items-center gap-1 text-warning">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span className="font-medium">Ожидает подтверждения</span>
                                                </div>
                                            ) : remaining > 0 && paymentOpen ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">
                                                        К оплате: <span className="font-medium text-foreground">{remaining.toLocaleString('ru-RU')} ₽</span>
                                                    </span>
                                                    <button
                                                        onClick={() => { onOpenChange(false); router.push(`/shop/purchase/${group.id}`); }}
                                                        className="flex items-center gap-1 font-medium text-primary hover:underline"
                                                    >
                                                        <CreditCard className="h-3 w-3" />
                                                        Оплатить
                                                    </button>
                                                </div>
                                            ) : paymentOpen ? (
                                                <span className="text-muted-foreground">
                                                    Итого: <span className="font-medium text-foreground">{group.total.toLocaleString('ru-RU')} ₽</span>
                                                </span>
                                            ) : (
                                                <div>
                                                    <span className="font-medium text-foreground">{group.total.toLocaleString('ru-RU')} ₽</span>
                                                    <button
                                                        disabled
                                                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground/50 cursor-not-allowed"
                                                    >
                                                        <CreditCard className="h-3 w-3" />
                                                        Ждём начала оплаты
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <Separator className="mt-3" />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="shrink-0 p-4" />

                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
