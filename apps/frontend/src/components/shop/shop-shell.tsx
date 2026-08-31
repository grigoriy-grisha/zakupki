'use client';

import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { cn } from '@/lib/utils';

import { ShopHeader } from './shop-header';
import { ShopSidebar } from './shop-sidebar';

export function ShopShell({ children }: { children: React.ReactNode }) {
    // Establish a NextAuth session from Telegram initData when opened inside the
    // Mini App. Otherwise the header would keep showing "Войти": useSession()
    // reads the session cookie, which only exists after this call succeeds.
    // Outside a Mini App (browser/VK) the hook is a no-op.
    useTelegramAutoLogin();

    return (
        <div className="flex h-[100dvh] flex-col bg-bg-base">
            <ShopHeader />

            {/* Mobile: horizontal scrollable purchase tabs */}
            <div className="border-b border-border-low md:hidden">
                <MobilePurchaseTabs />
            </div>

            <div className="flex min-h-0 flex-1 gap-0 md:gap-2 md:p-2">
                <ShopSidebar className="hidden md:flex" />

                <main className="min-h-0 flex-1 overflow-y-auto bg-bg-base">{children}</main>
            </div>

        </div>
    );
}

function MobilePurchaseTabs() {
    const router = useAppRouter();
    const pathname = useAppPathname();
    const { data: purchases } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE'],
    });

    const match = pathname.match(/\/shop\/purchase\/(\d+)/);
    const activePurchaseId = match ? Number(match[1]) : null;

    if (!purchases?.length) return null;

    return (
        <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {purchases.map((purchase) => {
                const isActive = activePurchaseId === purchase.id;
                return (
                    <Button
                        key={purchase.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                        className={cn(
                            'h-auto shrink-0 rounded-full px-3 py-1.5 text-14-medium',
                            isActive
                                ? 'bg-primary text-white hover:bg-primary/90'
                                : 'bg-bg-soft text-fg-secondary',
                        )}
                    >
                        {purchase.tag}
                    </Button>
                );
            })}
        </div>
    );
}
