'use client';

import { FileText, LogIn, LogOut, ShoppingCart, User } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

import { AppLink } from '@/components/app-link';
import { NotificationBell } from '@/components/shop/notification-bell';
import { withPlatformPrefix } from '@/lib/app-path';
import { useIsTelegramWebApp } from '@/lib/hooks/use-is-telegram-web-app';
import { usePlatform } from '@/lib/hooks/use-platform';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { cn } from '@/lib/utils';

const navLinkClass = cn(
    'flex h-10 items-center gap-2 rounded-full px-2.5 text-14-medium text-fg-primary',
    'transition-colors hover:bg-bg-soft sm:px-3.5',
);

export function ShopHeader() {
    const { data: session } = useSession();
    const platform = usePlatform();
    const { isAdmin } = useUserRole();
    const isTelegramWebApp = useIsTelegramWebApp();
    const isAuthenticated = !!session?.user || isTelegramWebApp;

    return (
        <header
            className={cn(
                'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-low',
                'bg-bg-base px-4 sm:px-8',
            )}
        >
            <AppLink
                href={isAdmin ? '/' : '/shop'}
                className="flex items-center gap-2.5 text-fg-primary transition-colors hover:text-primary"
            >
                <ShoppingCart className="size-5" />
                <span className="text-16-medium sm:text-18-medium">Закупки</span>
            </AppLink>

            <nav className="flex items-center gap-1 sm:gap-2">
                {isAuthenticated ? (
                    <>
                        <AppLink href="/shop/profile" className={navLinkClass}>
                            <User className="size-[18px]" />
                            <span className="hidden sm:inline">Профиль</span>
                        </AppLink>
                        <AppLink href="/shop/orders" className={navLinkClass}>
                            <FileText className="size-[18px]" />
                            <span className="hidden sm:inline">Заказы</span>
                        </AppLink>
                        <NotificationBell />
                        {!isTelegramWebApp && (
                            <button
                                type="button"
                                className={cn(navLinkClass, 'px-2.5 text-fg-secondary sm:px-3')}
                                onClick={() => {
                                    const base =
                                        process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ??
                                        window.location.origin;
                                    const loginPath = platform
                                        ? withPlatformPrefix('/login', platform)
                                        : '/login';
                                    void signOut({ callbackUrl: `${base}${loginPath}` });
                                }}
                                aria-label="Выйти"
                            >
                                <LogOut className="size-[18px]" />
                            </button>
                        )}
                    </>
                ) : (
                    <AppLink
                        href={platform ? withPlatformPrefix('/login', platform) : '/login'}
                        className={navLinkClass}
                    >
                        <LogIn className="size-[18px]" />
                        Войти
                    </AppLink>
                )}
            </nav>
        </header>
    );
}
