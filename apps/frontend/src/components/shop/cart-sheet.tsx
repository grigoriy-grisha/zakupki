'use client';

import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShoppingCart, Trash2, ArrowRight, CircleCheck, Clock, CreditCard } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { CartLineQuantityControls } from '@/components/shop/cart-line-quantity-controls';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { cn } from '@/lib/utils';
import { PURCHASE_FULFILLMENT_LABELS, isPurchasePaymentOpen, type PurchaseFulfillmentStatus, getUnitByCode } from '@zakupki/types';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { PurchasePaymentDialog } from '@/components/shop/purchase-payment-dialog';
import { summarizePurchasePayments } from '@/components/shop/payment-proof';

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
    const grouped = new Map<
        number,
        {
            id: number;
            orderNumber: number | null;
            tag: string;
            supplier: string;
            orders: NonNullable<typeof myOrders>;
            total: number;
            fulfillmentStatus: string | null;
        }
    >();

    if (myOrders) {
        for (const order of myOrders) {
            const purchase = (order as any).purchaseItem?.purchase;
            if (!purchase) continue;
            const pid = purchase.id as number;
            const purchaseOrderId = (order as { purchaseOrderId?: number | null }).purchaseOrderId ?? null;
            if (!grouped.has(pid)) {
                grouped.set(pid, {
                    id: pid,
                    orderNumber: purchaseOrderId,
                    tag: purchase.tag,
                    supplier: purchase.supplier,
                    orders: [],
                    total: 0,
                    fulfillmentStatus: (purchase as any).fulfillmentStatus ?? null,
                });
            }
            const group = grouped.get(pid)!;
            if (group.orderNumber == null && purchaseOrderId != null) {
                group.orderNumber = purchaseOrderId;
            }
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
                            <Badge variant="secondary" className="ml-1">
                                {myOrders.length}
                            </Badge>
                        )}
                    </SheetTitle>
                </SheetHeader>

                {!myOrders?.length ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Корзина пуста</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                onOpenChange(false);
                                router.push('/shop');
                            }}
                        >
                            К закупкам
                            <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                            {groups.map((group) => {
                                const purchasePayments = myPayments?.filter((p) => p.purchaseId === group.id) ?? [];
                                const { remaining, hasPending, isFullyPaid } = summarizePurchasePayments(
                                    group.total,
                                    purchasePayments,
                                );
                                const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
                                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fs];
                                const paymentOpen = isPurchasePaymentOpen(fs);

                                return (
                                    <div key={group.id}>
                                        <div className="mb-2">
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => {
                                                        onOpenChange(false);
                                                        router.push(`/shop/purchase/${group.id}`);
                                                    }}
                                                    className="font-semibold text-sm hover:text-primary transition-colors text-left"
                                                >
                                                    {group.supplier}
                                                </button>
                                                <Badge variant="outline" className="text-xs font-normal">
                                                    {group.tag}
                                                </Badge>
                                            </div>
                                        </div>

                                        {group.orders.map((order) => {
                                            const purchaseItem = (
                                                order as {
                                                    purchaseItem?: {
                                                        id: number;
                                                        product?: ProductLabelSource & {
                                                            photos: { id: number }[];
                                                            unitCode: string;
                                                            multiplicity: string | number;
                                                            minPackageAmount: string | number | null;
                                                            minPackageUnit: string | null;
                                                        };
                                                    };
                                                }
                                            ).purchaseItem;
                                            const product = purchaseItem?.product;
                                            const shortName = product?.unitCode ? getUnitByCode(product.unitCode)?.shortName ?? 'ед.' : 'ед.';
                                            const photo = product?.photos?.[0];
                                            const qty = Number(order.quantity);
                                            const amount = Number(order.amountDue);

                                            return (
                                                <div key={order.id} className="flex gap-2 py-2">
                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                                        {photo ? (
                                                            <img
                                                                src={absoluteProductPhotoUrl(photo.id)}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center">
                                                                <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-2">
                                                        <div className="min-w-0 overflow-hidden">
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
                                                        <div className="flex items-center justify-between gap-2">
                                                            {purchaseItem && product?.unitCode ? (
                                                                <CartLineQuantityControls
                                                                    orderId={order.id}
                                                                    purchaseItemId={purchaseItem.id}
                                                                    purchaseId={group.id}
                                                                    quantity={qty}
                                                                    unitShort={shortName}
                                                                    multiplicity={Number(product.multiplicity)}
                                                                    minPackageAmount={
                                                                        product.minPackageAmount != null
                                                                            ? Number(product.minPackageAmount)
                                                                            : null
                                                                    }
                                                                    minPackageUnit={product.minPackageUnit}
                                                                    purchaseItemMinQty={null}
                                                                />
                                                            ) : (
                                                                <span />
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                                                disabled={deleteOrder.isPending}
                                                                onClick={() => {
                                                                    deleteOrder.mutate(
                                                                        { id: order.id },
                                                                        {
                                                                            onSuccess: () =>
                                                                                utils.orders.getMyOrders.invalidate(),
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
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
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-muted-foreground">
                                                        К оплате:{' '}
                                                        <span className="font-medium text-foreground">
                                                            {remaining.toLocaleString('ru-RU')} ₽
                                                        </span>
                                                    </span>
                                                    <PurchasePaymentDialog
                                                        purchaseId={group.id}
                                                        remaining={remaining}
                                                        hasPending={hasPending}
                                                        paymentOpen={paymentOpen}
                                                        triggerVariant="link"
                                                    />
                                                </div>
                                            ) : paymentOpen ? (
                                                <span className="text-muted-foreground">
                                                    Итого:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {group.total.toLocaleString('ru-RU')} ₽
                                                    </span>
                                                </span>
                                            ) : (
                                                <div>
                                                    <span className="font-medium text-foreground">
                                                        {group.total.toLocaleString('ru-RU')} ₽
                                                    </span>
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
