'use client';

import { useAppBackTracker } from '@/lib/hooks/use-app-back';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { useTelegramBackButton } from '@/lib/hooks/use-telegram-back-button';

import { ShopFooter } from './shop-footer';
import { ShopHeader } from './shop-header';
import { ShopPageContent } from './shop-page-content';
import { ShopSidebar } from './shop-sidebar';
import { SidebarSlotProvider } from './sidebar-slot';

export function ShopShell({ children }: { children: React.ReactNode }) {
    useTelegramAutoLogin();
    const canGoBack = useAppBackTracker();
    useTelegramBackButton(canGoBack);

    return (
        <SidebarSlotProvider>
            <div className="flex min-h-[100dvh] flex-col bg-bg-base">
                <ShopHeader />

                <div className="flex min-w-0 flex-1">
                    <ShopSidebar className="hidden md:flex" />

                    <main className="min-w-0 flex-1">
                        <ShopPageContent>{children}</ShopPageContent>
                    </main>
                </div>

                <ShopFooter />
            </div>
        </SidebarSlotProvider>
    );
}
