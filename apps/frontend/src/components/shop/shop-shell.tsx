'use client';

import { trpc } from '@/lib/client/trpc';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';

import { ShopHeader } from './shop-header';
import { ShopSidebar } from './shop-sidebar';
import { ShopFooter } from './shop-footer';

export function ShopShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-[100dvh] flex-col">
            <ShopHeader />

            {/* Mobile: horizontal scrollable purchase tabs */}
            <div className="border-b md:hidden">
                <MobilePurchaseTabs />
            </div>

            <div className="flex min-h-0 flex-1">
                {/* Desktop sidebar */}
                <ShopSidebar className="hidden md:flex" />

                <main className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4 md:p-6">{children}</div>
                </main>
            </div>

            <ShopFooter />
        </div>
    );
}

function MobilePurchaseTabs() {
    const router = useAppRouter();
    const pathname = useAppPathname();
    const { data: purchases } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE', 'SUPPLEMENT'],
    });

    const match = pathname.match(/\/shop\/purchase\/(\d+)/);
    const activePurchaseId = match ? Number(match[1]) : null;

    if (!purchases?.length) return null;

    return (
        <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {purchases.map((purchase) => {
                const isActive = activePurchaseId === purchase.id;
                return (
                    <button
                        key={purchase.id}
                        onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                        className={cn(
                            'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {purchase.tag || purchase.supplier}
                    </button>
                );
            })}
        </div>
    );
}
