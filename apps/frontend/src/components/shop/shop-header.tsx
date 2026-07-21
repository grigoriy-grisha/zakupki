'use client';

import { useSession, signOut } from 'next-auth/react';
import { ShoppingCart, LogIn, LogOut, User, ClipboardList } from 'lucide-react';

import { AppLink } from '@/components/app-link';
import { NotificationBell } from '@/components/shop/notification-bell';
import { Button } from '@/components/ui/button';
import { withPlatformPrefix } from '@/lib/app-path';
import { usePlatform } from '@/lib/hooks/use-platform';
import { useUserRole } from '@/lib/hooks/use-user-role';

export function ShopHeader() {
    const { data: session } = useSession();
    const platform = usePlatform();
    const { isAdmin } = useUserRole();

    return (
        <header className="flex h-14 shrink-0 items-center justify-between bg-bg-card px-4">
            <AppLink href={isAdmin ? '/' : '/shop'} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <ShoppingCart className="h-4 w-4" />
                </div>
                <span className="text-18-semibold tracking-tight text-fg-primary">Закупки</span>
            </AppLink>

            <div className="flex items-center gap-1">
                {session?.user ? (
                    <>
                        <AppLink href="/shop/profile">
                            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
                                <User className="h-4 w-4" />
                                <span className="hidden sm:inline">Профиль</span>
                            </Button>
                        </AppLink>
                        <AppLink href="/shop/orders">
                            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
                                <ClipboardList className="h-4 w-4" />
                                <span className="hidden sm:inline">Заказы</span>
                            </Button>
                        </AppLink>
                        <NotificationBell />
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-fg-secondary"
                            onClick={() => {
                                const base =
                                    process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ??
                                    window.location.origin;
                                const loginPath = platform ? withPlatformPrefix('/login', platform) : '/login';
                                void signOut({ callbackUrl: `${base}${loginPath}` });
                            }}
                            aria-label="Выйти"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </>
                ) : (
                    <AppLink href={platform ? withPlatformPrefix('/login', platform) : '/login'}>
                        <Button variant="outline" size="sm" className="rounded-full">
                            <LogIn className="mr-2 h-4 w-4" />
                            Войти
                        </Button>
                    </AppLink>
                )}
            </div>
        </header>
    );
}
