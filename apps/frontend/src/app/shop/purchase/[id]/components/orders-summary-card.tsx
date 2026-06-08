'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { getProductPhotoId, type ProductLabelSource } from '@/app/(admin)/products/lib';
import { CircleCheck, Package, Trash2 } from 'lucide-react';
import { MyPaymentRow } from '@/components/shop/my-payment-row';
import type { ShopPaymentView } from '@/components/shop/payment-proof';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';
import { getUnitByCode } from '@zakupki/types';

import type { ReactNode } from 'react';
import type { usePurchasePaymentDetail } from '../hooks/use-purchase-payment-detail';

interface OrdersSummaryCardProps {
    paymentDetail: ReturnType<typeof usePurchasePaymentDetail>;
    paymentDialog: ReactNode;
    purchaseItems?: { id: number; product: ProductLabelSource }[];
    fulfillmentLabel: string;
}

export function OrdersSummaryCard({
    paymentDetail,
    paymentDialog,
    purchaseItems,
    fulfillmentLabel,
}: OrdersSummaryCardProps) {
    const { myOrdersInPurchase, totalDue, purchasePayments, hasPending, totalPaid, remaining, isFullyPaid } =
        paymentDetail;
    const purchaseOrderId =
        (myOrdersInPurchase[0] as { purchaseOrderId?: number | null } | undefined)?.purchaseOrderId ?? null;
    const productByItemId = useMemo(
        () => new Map(purchaseItems?.map((item) => [item.id, item.product]) ?? []),
        [purchaseItems],
    );

    return (
        <Card>
            <CardContent className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        {purchaseOrderId != null && (
                            <p className="text-sm font-medium tabular-nums text-muted-foreground">
                                Заказ №{purchaseOrderId}
                            </p>
                        )}
                        <h3 className="font-semibold">Ваши заказы</h3>
                    </div>
                    <Badge variant="outline" className="font-normal">
                        <Package className="mr-1 h-3 w-3" />
                        {fulfillmentLabel}
                    </Badge>
                </div>

                <div className="space-y-2">
                    {myOrdersInPurchase.map((order) => {
                        const product = productByItemId.get(order.purchaseItemId);
                        const photoId =
                            product != null
                                ? getProductPhotoId(product)
                                : (order.purchaseItem?.product?.photos?.[0]?.id ?? null);
                        const label = product != null ? undefined : (order.purchaseItem?.product?.name ?? 'Товар');

                        return (
                            <div
                                key={order.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <ProductPhotoPreview photoId={photoId} alt={label ?? 'Фото товара'} />
                                    {product ? (
                                        <PurchaseProductLabel product={product} className="min-w-0 text-sm" />
                                    ) : (
                                        <span className="text-sm">{label}</span>
                                    )}
                                </div>
                                <span className="shrink-0 text-right text-sm font-medium">
                                    {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                    {order.purchaseItem?.product?.unitCode ? getUnitByCode(order.purchaseItem.product.unitCode)?.shortName ?? '' : ''}
                                    <br />
                                    <span className="text-muted-foreground">
                                        {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Payment balance */}
                <div className="rounded-xl border p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground">К оплате</p>
                            <p className="text-lg font-bold">{totalDue.toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Покрыто</p>
                            <p className="text-lg font-bold text-success">{totalPaid.toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Осталось</p>
                            <p className={cn('text-lg font-bold', remaining > 0 ? 'text-warning' : 'text-success')}>
                                {remaining.toLocaleString('ru-RU')} ₽
                            </p>
                        </div>
                    </div>

                    {/* Existing payments list */}
                    {purchasePayments.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            {purchasePayments.map((p) => (
                                <MyPaymentRow
                                    key={p.id}
                                    payment={p as ShopPaymentView}
                                    trailing={
                                        (p as { status: string }).status === 'PENDING' ? (
                                            <CancelPaymentButton paymentId={p.id} />
                                        ) : null
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Pay button or status */}
                    {!isFullyPaid && !hasPending && remaining > 0 && paymentDialog}
                    {hasPending && (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-warning/10 py-2 text-warning">
                            <span className="text-sm font-medium">Ожидает подтверждения оплаты</span>
                        </div>
                    )}
                    {isFullyPaid && (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-success-50 py-2 text-success">
                            <CircleCheck className="h-4 w-4" />
                            <span className="text-sm font-medium">Полностью оплачено</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function CancelPaymentButton({ paymentId }: { paymentId: number }) {
    const utils = trpc.useUtils();
    const mutation = trpc.payments.cancel.useMutation({
        onSuccess: () => {
            void utils.payments.getMyPayments.invalidate();
            void utils.orders.getMyOrders.invalidate();
            toast.success('Оплата отменена');
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => mutation.mutate({ id: paymentId })}
            disabled={mutation.isPending}
        >
            <Trash2 className="h-3 w-3" />
            Отменить
        </Button>
    );
}
