'use client';

import { AppLink } from '@/components/app-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { daysLeftUntil, formatDeadlineShort } from '@/lib/utils/date';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';
import { STATUS_LABELS, STATUS_VARIANT } from '../../lib/constants';
import { PurchaseFulfillmentStatusSelect } from './purchase-fulfillment-status-select';

interface AdminPurchaseListCardProps {
    purchase: {
        id: number;
        tag: string;
        supplier: string;
        status: string;
        fulfillmentStatus?: PurchaseFulfillmentStatus | null;
        deadline: string;
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

export function PurchaseCard({ purchase }: AdminPurchaseListCardProps) {
    const utils = trpc.useUtils();
    const updateFulfillmentStatus = trpc.purchases.updateFulfillmentStatus.useMutation({
        onSuccess: () => {
            void utils.purchases.list.invalidate();
            toast.success('Этап закупки обновлён');
        },
        onError: (err) => toast.error(err.message),
    });

    const daysLeft = daysLeftUntil(purchase.deadline);
    const totalOrders = purchase.items.reduce((sum, item) => sum + item.orderLines.length, 0);
    const totalAmount = purchase.items.reduce(
        (sum, item) => sum + item.orderLines.reduce((s, ol) => s + Number(ol.amountDue), 0),
        0,
    );
    const isDraft = purchase.status === 'DRAFT';

    return (
        <Card className="transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <AppLink href={`/purchases/${purchase.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                    <CardTitle className="text-base">{purchase.tag}</CardTitle>
                    <Badge variant={STATUS_VARIANT[purchase.status] ?? 'secondary'}>
                        {STATUS_LABELS[purchase.status] ?? purchase.status}
                    </Badge>
                </AppLink>
            </CardHeader>
            <CardContent className="space-y-3">
                <AppLink href={`/purchases/${purchase.id}`}>
                    <p className="font-medium">{purchase.supplier}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>До {formatDeadlineShort(purchase.deadline)}</span>
                        {purchase.status === 'ACTIVE' && (
                            <span className={daysLeft <= 3 ? 'text-destructive font-medium' : ''}>
                                {daysLeft > 0 ? `${daysLeft} дн.` : 'Просрочено'}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                        <span>{purchase.items.length} товаров</span>
                        <span>{totalOrders} заказов</span>
                        <span className="font-medium">{totalAmount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                </AppLink>
                {!isDraft && (
                    <div
                        className="pt-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Этап</p>
                        <PurchaseFulfillmentStatusSelect
                            value={purchase.fulfillmentStatus}
                            disabled={updateFulfillmentStatus.isPending}
                            triggerClassName="h-9 text-sm"
                            onChange={(fulfillmentStatus) => {
                                updateFulfillmentStatus.mutate({ id: purchase.id, fulfillmentStatus });
                            }}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
