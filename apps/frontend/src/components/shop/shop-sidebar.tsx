'use client';

import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';

import { SidebarSlot } from './sidebar-slot';

interface ShopSidebarProps {
    className?: string;
}

export function ShopSidebar({ className }: ShopSidebarProps) {
    const router = useAppRouter();
    const pathname = useAppPathname();
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE'],
    });

    const match = pathname.match(/\/shop\/purchase\/(\d+)/);
    const activePurchaseId = match ? Number(match[1]) : null;

    return (
        <aside
            className={cn(
                'sticky top-14 h-[calc(100dvh-3.5rem)] w-[280px] shrink-0 hidden md:flex flex-col relative',
                className,
            )}
        >
            <span aria-hidden className="absolute bottom-10 right-0 top-10 w-0.5 bg-secondary" />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-10 pt-5">
                <div>
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-8 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : !purchases?.length ? (
                        <p className="text-14-regular text-fg-secondary">Нет активных закупок</p>
                    ) : (
                        <nav className="flex flex-col items-start gap-3.5">
                            {purchases.map((purchase) => {
                                const isActive = activePurchaseId === purchase.id;
                                const fulfillmentStatus = (purchase.fulfillmentStatus ??
                                    'COLLECTION') as PurchaseFulfillmentStatus;
                                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];

                                return (
                                    <button
                                        key={purchase.id}
                                        type="button"
                                        onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                                        className="max-w-full text-left transition-colors hover:text-secondary"
                                    >
                                        <span
                                            className={cn(
                                                'font-display leading-tight',
                                                isActive
                                                    ? 'text-24-semibold text-secondary'
                                                    : 'text-18-semibold text-fg-primary',
                                            )}
                                        >
                                            {purchase.tag}
                                        </span>
                                        {isActive && (
                                            <span className="mt-0.5 block truncate text-12-regular text-fg-tertiary">
                                                {fulfillmentLabel}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    )}
                </div>

                <SidebarSlot />
            </div>
        </aside>
    );
}
