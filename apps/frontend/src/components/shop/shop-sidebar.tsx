'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';
import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

interface ShopSidebarProps {
    className?: string;
}

export function ShopSidebar({ className }: ShopSidebarProps) {
    const router = useAppRouter();
    const pathname = useAppPathname();
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE', 'SUPPLEMENT'],
    });

    // Extract purchaseId from path like /shop/purchase/123
    const match = pathname.match(/\/shop\/purchase\/(\d+)/);
    const activePurchaseId = match ? Number(match[1]) : null;

    return (
        <aside className={cn('flex w-56 shrink-0 flex-col border-r bg-card overflow-y-auto', className)}>
            <div className="p-3">
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Закупки
                </p>

                {isLoading ? (
                    <div className="space-y-2 px-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : !purchases?.length ? (
                    <p className="px-2 text-sm text-muted-foreground">Нет активных закупок</p>
                ) : (
                    <nav className="space-y-1">
                        {purchases.map((purchase) => {
                            const isActive = activePurchaseId === purchase.id;
                            const isSupplement = purchase.status === 'SUPPLEMENT';
                            const fulfillmentStatus = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
                            const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];

                            return (
                                <button
                                    key={purchase.id}
                                    onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                                    className={cn(
                                        'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-sm font-medium transition-all text-left',
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="min-w-0 truncate">{purchase.tag || purchase.supplier}</span>
                                        {isSupplement && (
                                            <span className="shrink-0 rounded bg-warning/10 px-1 py-0.5 text-[10px] font-medium text-warning">
                                                добор
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        'text-[11px] leading-tight',
                                        isActive ? 'text-primary/70' : 'text-muted-foreground/70',
                                    )}>
                                        {fulfillmentLabel}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>
        </aside>
    );
}
