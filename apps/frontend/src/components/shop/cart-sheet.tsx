'use client';

import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShoppingCart, Trash2, ArrowRight, Minus, Plus } from 'lucide-react';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { PaymentStatusBlock } from '@/components/shop/payment-status-block';
import { summarizePurchasePayments } from '@/components/shop/payment-proof';
import { groupOrdersByPurchase, type OrderPurchaseGroup } from '@/app/shop/lib/order-grouping';
import {
    PURCHASE_FULFILLMENT_LABELS,
    isPurchasePaymentOpen,
    type PurchaseFulfillmentStatus,
    getUnitByCode,
    getOrderQuantityStep,
    buildOrderQtyOptions,
} from '@zakupki/types';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { toast } from 'sonner';

interface CartSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const { data: myOrders, isLoading } = trpc.orders.getMyOrders.useQuery(undefined, { enabled: open });
    const { data: myPayments } = trpc.payments.getMyPayments.useQuery(undefined, { enabled: open });

    const groups = groupOrdersByPurchase((myOrders ?? []) as any);
    const grandTotal = myOrders?.reduce((s, o) => s + Number(o.amountDue), 0) ?? 0;

    // Одна мутация для ± (используется всеми строками)
    const adjustMutation = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
        },
        onError: (err) => toast.error(err.message),
    });

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
                                const purchasePayments =
                                    myPayments?.filter((p: any) => p.purchaseId === group.id) ?? [];
                                const { remaining, hasPending, isFullyPaid } = summarizePurchasePayments(
                                    group.total,
                                    purchasePayments,
                                );
                                const fs = (group.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

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
                                            const product:
                                                | (ProductLabelSource & {
                                                      photos: { id: number }[];
                                                      unitCode: string;
                                                      multiplicity?: string | number;
                                                      minPackageAmount?: string | number | null;
                                                      minPackageUnit?: string | null;
                                                  })
                                                | undefined = order.source.purchaseItem?.product;
                                            const shortName = product?.unitCode
                                                ? (getUnitByCode(product.unitCode)?.shortName ?? 'ед.')
                                                : 'ед.';
                                            const photo = product?.photos?.[0];
                                            const qty = order.quantity;
                                            const amount = order.amountDue;
                                            const purchaseItemId = order.purchaseItemId;

                                            // Шаг для ± (из multiplicity / minPackage)
                                            const orderStep = product
                                                ? getOrderQuantityStep(
                                                      buildOrderQtyOptions({
                                                          multiplicity: Number(product.multiplicity ?? 1),
                                                          minPackageAmount:
                                                              product.minPackageAmount != null
                                                                  ? Number(product.minPackageAmount)
                                                                  : null,
                                                          minPackageUnit: product.minPackageUnit ?? null,
                                                          purchaseItemMinQty: null,
                                                          unitShort: shortName,
                                                      }),
                                                  )
                                                : 1;

                                            return (
                                                <div key={order.purchaseItemId} className="flex gap-2 py-2">
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
                                                                {qty} {shortName} · {amount.toLocaleString('ru-RU')} ₽
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            {purchaseItemId && (
                                                                <div className="flex shrink-0 items-center gap-0.5">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        disabled={adjustMutation.isPending}
                                                                        aria-label={`Убрать ${orderStep} ${shortName}`}
                                                                        onClick={() => {
                                                                            // adjustQuantity с отрицательным delta
                                                                            // service сам делает zero-out на REORDER+ или hard delete на COLLECTION
                                                                            adjustMutation.mutate({
                                                                                purchaseItemId,
                                                                                delta: -qty,
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <PaymentStatusBlock
                                            total={group.total}
                                            remaining={remaining}
                                            hasPending={hasPending}
                                            isFullyPaid={isFullyPaid}
                                            paymentOpen={isPurchasePaymentOpen(fs)}
                                            purchaseId={group.id}
                                            orderCount={group.orders.length}
                                            size="compact"
                                        />

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
