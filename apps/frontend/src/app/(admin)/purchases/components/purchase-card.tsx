'use client';

import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { formatRub } from '@/lib/format/money';

import { STATUS_LABELS, STATUS_VARIANT } from '../../lib/constants';
import { usePurchaseActions } from '../[id]/hooks/use-purchase-actions';
import { PurchaseFulfillmentStatusSelect } from './purchase-fulfillment-status-select';

interface AdminPurchaseListCardProps {
    purchase: {
        id: number;
        tag: string;
        status: string;
        fulfillmentStatus?: PurchaseFulfillmentStatus | null;
        items?: { orderLines: { amountDue: unknown }[] }[];
    };
    deleted?: boolean;
}

export function PurchaseCard({ purchase, deleted = false }: AdminPurchaseListCardProps) {
    const items = purchase.items ?? [];
    const { updateFulfillmentStatus } = usePurchaseActions(purchase.id);

    const totalOrders = items.reduce((sum, item) => sum + item.orderLines.length, 0);
    const totalAmount = items.reduce(
        (sum, item) => sum + item.orderLines.reduce((s, ol) => s + Number(ol.amountDue), 0),
        0,
    );
    const isDraft = purchase.status === 'DRAFT';

    return (
        <div className="group flex h-full flex-col gap-2 rounded-2xl bg-bg-soft p-3.5 transition-shadow hover:shadow-lg">
            <div className="flex items-start justify-between gap-2">
                <AppLink
                    href={`/purchases/${purchase.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 leading-tight"
                >
                    <span className="truncate font-display text-18-semibold text-secondary">{purchase.tag}</span>
                    <Badge variant={STATUS_VARIANT[purchase.status] ?? 'secondary'} type="subtle" size="sm">
                        {STATUS_LABELS[purchase.status] ?? purchase.status}
                    </Badge>
                    {deleted && (
                        <Badge variant="critical" type="subtle" size="sm">
                            Удалена
                        </Badge>
                    )}
                </AppLink>
            </div>

            <AppLink href={`/purchases/${purchase.id}`} className="block">
                <div className="mt-1 flex items-center gap-2 text-12-regular text-fg-tertiary">
                    <span className="tabular-nums">{items.length} тов.</span>
                    <span className="text-fg-disabled">·</span>
                    <span className="tabular-nums">{totalOrders} заказ.</span>
                    <span className="text-fg-disabled">·</span>
                    <span className="text-14-semibold text-primary tabular-nums">{formatRub(totalAmount)}</span>
                </div>
            </AppLink>

            {!isDraft && (
                <div className="pt-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
