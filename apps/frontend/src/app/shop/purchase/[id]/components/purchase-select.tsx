'use client';

import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { ChevronDown } from 'lucide-react';

import { AppLink } from '@/components/app-link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import { getPurchaseStageLabel } from './purchase-stepper';

export function PurchaseSelect({ currentPurchaseId }: { currentPurchaseId: number }) {
    const { data: purchases } = trpc.purchases.list.useQuery({ statuses: ['ACTIVE'] });

    if (!purchases?.length) return null;

    const current = purchases.find((p) => p.id === currentPurchaseId);
    const currentStatus = (current?.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-12 w-full items-center justify-between gap-3 rounded-full bg-bg-soft px-5 text-left"
                >
                    <span className="font-display text-18-semibold leading-none text-secondary">
                        {current?.tag ?? '#…'}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                        {current && (
                            <span className="inline-flex h-7 items-center rounded-full border border-secondary px-3.5 text-12-medium text-secondary">
                                {getPurchaseStageLabel(currentStatus)}
                            </span>
                        )}
                        <ChevronDown className="size-4 shrink-0 text-fg-secondary" />
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-0 bg-white/80 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur-xl"
            >
                <div className="flex flex-col items-stretch gap-1">
                    {purchases.map((purchase) => {
                        const isActive = purchase.id === currentPurchaseId;
                        const status = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

                        return (
                            <AppLink
                                key={purchase.id}
                                href={`/shop/purchase/${purchase.id}`}
                                className={cn(
                                    'block px-4 py-3 transition-colors',
                                    isActive
                                        ? 'rounded-xl border-2 border-gold bg-white/70'
                                        : 'rounded-xl hover:bg-bg-soft',
                                )}
                            >
                                <span className="flex min-w-0 items-baseline gap-2">
                                    <span
                                        className={cn(
                                            'font-display leading-tight',
                                            isActive ? 'text-24-semibold text-secondary' : 'text-18-semibold text-fg-primary',
                                        )}
                                    >
                                        {purchase.tag}
                                    </span>
                                    <span className="min-w-0 truncate text-12-regular text-fg-tertiary">
                                        {PURCHASE_FULFILLMENT_LABELS[status]}
                                    </span>
                                </span>
                            </AppLink>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
