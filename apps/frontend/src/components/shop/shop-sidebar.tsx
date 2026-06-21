'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';
import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { AppLink } from '@/components/app-link';

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
                'flex w-[260px] shrink-0 flex-col overflow-y-auto bg-bg-base',
                className,
            )}
        >
            <div className="p-3">
                <p className="mb-2 px-3 text-12-medium uppercase tracking-wider text-fg-tertiary">Закупки</p>

                {isLoading ? (
                    <div className="space-y-1.5 px-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-full" />
                        ))}
                    </div>
                ) : !purchases?.length ? (
                    <p className="px-3 text-14-regular text-fg-secondary">Нет активных закупок</p>
                ) : (
                    <nav className="flex flex-col gap-0.5">
                        {purchases.map((purchase) => {
                            const isActive = activePurchaseId === purchase.id;
                            const isSupplement = (purchase.fulfillmentStatus ?? 'COLLECTION') === 'REORDER';
                            const fulfillmentStatus = ((purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus);
                            const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];

                            return (
                                <Button
                                    key={purchase.id}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                                    className={cn(
                                        'h-auto w-full justify-between gap-2 rounded-full px-3 py-2 text-left',
                                        isActive
                                            ? 'bg-bg-soft text-fg-primary hover:bg-bg-soft'
                                            : 'text-fg-secondary',
                                    )}
                                >
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="truncate text-14-semibold">
                                            {purchase.tag || purchase.supplier}
                                        </span>
                                        {isSupplement && (
                                            <span className="shrink-0 rounded-md bg-warning-50 px-1 py-0.5 text-12-medium text-warning">
                                                добор
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'shrink-0 text-right text-12-regular',
                                            isActive ? 'text-fg-secondary' : 'text-fg-tertiary',
                                        )}
                                    >
                                        {fulfillmentLabel}
                                    </span>
                                </Button>
                            );
                        })}
                    </nav>
                )}
            </div>
        </aside>
    );
}
