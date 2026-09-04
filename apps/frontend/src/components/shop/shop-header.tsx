'use client';

import { ClipboardList, ShoppingBasket } from 'lucide-react';
import { signOut,useSession } from 'next-auth/react';
import { useState } from 'react';

import { AppLink } from '@/components/app-link';
import {
    BrandLogo,
    HeaderBellIcon,
    HeaderLogoutIcon,
    HeaderProfileIcon,
} from '@/components/icons';
import { NotificationBell } from '@/components/shop/notification-bell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { withPlatformPrefix } from '@/lib/app-path';
import { useIsTelegramWebApp } from '@/lib/hooks/use-is-telegram-web-app';
import { usePlatform } from '@/lib/hooks/use-platform';
import { cn } from '@/lib/utils';

const navLinkClass = cn(
    'flex h-10 items-center gap-2 rounded-full px-2.5 text-14-medium text-fg-primary',
    'transition-colors hover:bg-bg-soft sm:px-3.5',
);

export function ShopHeader() {
    const { data: session } = useSession();
    const platform = usePlatform();
    const isTelegramWebApp = useIsTelegramWebApp();
    const isAuthenticated = !!session?.user || isTelegramWebApp;
    const [logoutOpen, setLogoutOpen] = useState(false);

    const handleLogout = () => {
        setLogoutOpen(false);
        const base =
            process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ?? window.location.origin;
        const loginPath = platform ? withPlatformPrefix('/login', platform) : '/login';
        void signOut({ callbackUrl: `${base}${loginPath}` });
    };

    return (
        <header
            className={cn(
                'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-low',
                'bg-bg-base px-4 sm:px-8',
            )}
        >
            <AppLink
                href="/shop"
                aria-label="На главную"
                className="flex items-center transition-opacity hover:opacity-80"
            >
                <BrandLogo className="h-9 w-auto text-primary" />
            </AppLink>

            <nav className="flex items-center gap-1 sm:gap-2">
                {isAuthenticated ? (
                    <>
                        <AppLink href="/shop/profile" className={navLinkClass}>
                            <HeaderProfileIcon className="size-5" />
                            <span className="hidden sm:inline">Профиль</span>
                        </AppLink>
                        <AppLink href="/shop/orders" className={navLinkClass} aria-label="Корзина">
                            <ShoppingBasket className="size-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline">Корзина</span>
                        </AppLink>
                        <AppLink href="/shop/orders" className={navLinkClass}>
                            <ClipboardList className="size-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline">Заказы</span>
                        </AppLink>
                        <NotificationBell icon={HeaderBellIcon} iconClassName="size-5 text-fg-primary" />
                        {!isTelegramWebApp && (
                            <button
                                type="button"
                                className={cn(navLinkClass, 'px-2.5 text-fg-primary sm:px-3')}
                                onClick={() => setLogoutOpen(true)}
                                aria-label="Выйти"
                            >
                                <HeaderLogoutIcon className="size-5" />
                            </button>
                        )}
                    </>
                ) : (
                    <AppLink
                        href={platform ? withPlatformPrefix('/login', platform) : '/login'}
                        className={navLinkClass}
                    >
                        <HeaderLogoutIcon className="size-5" />
                        Войти
                    </AppLink>
                )}
            </nav>

            <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Выйти из аккаунта?</DialogTitle>
                        <DialogDescription>
                            Вы сможете снова войти через VK или Telegram.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)}>
                            Отмена
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleLogout}>
                            Выйти
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </header>
    );
}
