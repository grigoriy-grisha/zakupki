'use client';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { daysLeftUntil, formatDeadlineShort } from '@/lib/utils/date';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';
import { STATUS_LABELS, STATUS_VARIANT } from '../../lib/constants';
import { PurchaseFulfillmentStatusSelect } from './purchase-fulfillment-status-select';
import { cn } from '@/lib/utils';

interface AdminPurchaseListCardProps {
    purchase: {
        id: number;
        tag: string;
        supplier: string;
        status: string;
        fulfillmentStatus?: PurchaseFulfillmentStatus | null;
        deadline: string;
        items?: { orderLines: { amountDue: unknown }[] }[];
    };
}

export function PurchaseCard({ purchase }: AdminPurchaseListCardProps) {
    const items = purchase.items ?? [];
    const utils = trpc.useUtils();
    const updateFulfillmentStatus = trpc.purchases.updateFulfillmentStatus.useMutation({
        onSuccess: () => {
            void utils.purchases.list.invalidate();
            toast.success('Этап закупки обновлён');
        },
        onError: (err) => toast.error(err.message),
    });

    const daysLeft = daysLeftUntil(purchase.deadline);
    const totalOrders = items.reduce((sum, item) => sum + item.orderLines.length, 0);
    const totalAmount = items.reduce(
        (sum, item) => sum + item.orderLines.reduce((s, ol) => s + Number(ol.amountDue), 0),
        0,
    );
    const isDraft = purchase.status === 'DRAFT';

    return (
        <div className="group flex h-full flex-col gap-2 rounded-2xl border border-border bg-bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-bg-soft">
            <div className="flex items-start justify-between gap-2">
                <AppLink
                    href={`/purchases/${purchase.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 leading-tight"
                >
                    <span className="truncate text-16-semibold text-fg-primary tracking-tight">
                        {purchase.tag}
                    </span>
                    <Badge
                        variant={STATUS_VARIANT[purchase.status] ?? 'secondary'}
                        type="subtle"
                        size="sm"
                    >
                        {STATUS_LABELS[purchase.status] ?? purchase.status}
                    </Badge>
                </AppLink>
                {purchase.status === 'ACTIVE' && (
                    <span
                        className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-12-medium tabular-nums',
                            daysLeft <= 3
                                ? 'bg-error-50 text-error'
                                : 'bg-bg-soft text-fg-secondary',
                        )}
                    >
                        {daysLeft > 0 ? `${daysLeft} дн.` : 'Просрочено'}
                    </span>
                )}
            </div>

            <AppLink href={`/purchases/${purchase.id}`} className="block">
                <p className="truncate text-13-medium text-fg-primary">{purchase.supplier}</p>
                <div className="mt-1 flex items-center gap-2 text-12-regular text-fg-tertiary">
                    <span>До {formatDeadlineShort(purchase.deadline)}</span>
                    <span className="text-fg-disabled">·</span>
                    <span className="tabular-nums">{items.length} тов.</span>
                    <span className="text-fg-disabled">·</span>
                    <span className="tabular-nums">{totalOrders} заказ.</span>
                    <span className="text-fg-disabled">·</span>
                    <span className="font-semibold text-fg-primary tabular-nums">
                        {totalAmount.toLocaleString('ru-RU')} ₽
                    </span>
                </div>
            </AppLink>

            {!isDraft && (
                <div
                    className="pt-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <PurchaseFulfillmentStatusSelect
                        value={purchase.fulfillmentStatus}
                        disabled={updateFulfillmentStatus.isPending}
                        triggerClassName="h-8 w-full rounded-full text-12-medium"
                        onChange={(fulfillmentStatus) => {
                            updateFulfillmentStatus.mutate({ id: purchase.id, fulfillmentStatus });
                        }}
                    />
                </div>
            )}
        </div>
    );
}
