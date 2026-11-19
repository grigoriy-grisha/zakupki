'use client';

import { ShoppingBasket } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';

import { summarizeAwaitingPayment } from '@/app/shop/lib/awaiting-payment';
import { type GroupableOrderLine, groupOrdersByPurchase } from '@/app/shop/lib/order-grouping';
import { AppLink } from '@/components/app-link';
import { BrandLogo, HeaderBellIcon, HeaderLogoutIcon, HeaderProfileIcon } from '@/components/icons';
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
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
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
    const awaiting = useAwaitingPaymentSummary(isAuthenticated);
    const cartLabel =
        awaiting.items > 0
            ? `Корзина: ${awaiting.items} ${pluralGoods(awaiting.items)} ждут оплаты на ${formatRub(awaiting.amount)}`
            : 'Корзина';

    const handleLogout = () => {
        setLogoutOpen(false);
        const base = process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ?? window.location.origin;
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
                        <AppLink
                            href="/shop/orders"
                            className={navLinkClass}
                            aria-label={cartLabel}
                            title={awaiting.items > 0 ? cartLabel : undefined}
                        >
                            <span className="relative">
                                <ShoppingBasket className="size-5" strokeWidth={1.5} />
                                {awaiting.items > 0 && (
                                    <span
                                        className={cn(
                                            'absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center',
                                            'rounded-full bg-primary px-1 text-[10px] font-bold leading-none',
                                            'text-primary-foreground tabular-nums ring-2 ring-bg-base',
                                        )}
                                    >
                                        {awaiting.items > 99 ? '99+' : awaiting.items}
                                    </span>
                                )}
                            </span>
                            <span className="hidden sm:inline">Корзина</span>
                            {awaiting.items > 0 && (
                                <span className="hidden whitespace-nowrap text-12-medium text-primary lg:inline">
                                    · к оплате {formatRub(awaiting.amount)}
                                </span>
                            )}
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
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Выйти из аккаунта?</DialogTitle>
                        <DialogDescription>Вы сможете снова войти через VK или Telegram.</DialogDescription>
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

/** Сколько товаров ждут оплаты: те же запросы, что и на странице корзины, — кэш общий. */
function useAwaitingPaymentSummary(enabled: boolean) {
    const { data: orders } = trpc.orders.getMyOrders.useQuery(undefined, { enabled, staleTime: 30_000 });
    const { data: payments } = trpc.payments.getMyPayments.useQuery(undefined, { enabled, staleTime: 30_000 });
    return useMemo(() => {
        if (!orders || !payments) return { items: 0, amount: 0, purchases: 0 };
        const groups = groupOrdersByPurchase(orders as unknown as GroupableOrderLine[]);
        return summarizeAwaitingPayment(groups, payments);
    }, [orders, payments]);
}

function pluralGoods(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'товар';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара';
    return 'товаров';
}
