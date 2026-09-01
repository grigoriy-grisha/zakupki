'use client';

import type { PurchaseFulfillmentStatus } from '@zakupki/types';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { AppLink } from '@/components/app-link';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import { getPurchaseStageLabel } from './purchase-stepper';

export function PurchaseSelect({ currentPurchaseId }: { currentPurchaseId: number }) {
    const [open, setOpen] = useState(false);
    const { data: purchases } = trpc.purchases.list.useQuery({ statuses: ['ACTIVE'] });

    if (!purchases?.length) return null;

    const current = purchases.find((p) => p.id === currentPurchaseId);
    const currentStatus = (current?.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
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
            </SheetTrigger>
            <SheetContent
                side="bottom"
                showCloseButton={false}
                className="rounded-b-none rounded-t-[20px] border-2 border-b-0 border-gold bg-bg-soft p-0"
            >
                <span aria-hidden className="mx-auto mt-3 block h-1 w-10 rounded-full bg-secondary/40" />
                <div className="px-7 pt-4">
                    <SheetTitle asChild>
                        <p className="font-display text-30-semibold leading-none text-primary">Закупки</p>
                    </SheetTitle>
                </div>
                <div className="flex flex-col items-stretch gap-1.5 px-4 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-4">
                    {purchases.map((purchase) => {
                        const isActive = purchase.id === currentPurchaseId;
                        const status = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;

                        return (
                            <AppLink
                                key={purchase.id}
                                href={`/shop/purchase/${purchase.id}`}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    'flex w-full items-center justify-between gap-3 rounded-full py-3 pl-5 pr-3 transition-colors',
                                    isActive ? 'bg-white' : 'bg-bg-card/50 hover:bg-bg-card',
                                )}
                            >
                                <span
                                    className={cn(
                                        'min-w-0 truncate font-display leading-tight',
                                        isActive ? 'text-20-semibold text-secondary' : 'text-18-semibold text-fg-primary',
                                    )}
                                >
                                    {purchase.tag}
                                </span>
                                <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-secondary/60 px-3 text-12-medium text-secondary">
                                    {getPurchaseStageLabel(status)}
                                </span>
                            </AppLink>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    );
}
