'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ShoppingCart, LogIn, LogOut, User, ClipboardList } from 'lucide-react';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { withPlatformPrefix } from '@/lib/app-path';
import { usePlatform } from '@/lib/hooks/use-platform';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { trpc } from '@/lib/client/trpc';
import { CartSheet } from './cart-sheet';

export function ShopHeader() {
    const { data: session } = useSession();
    const platform = usePlatform();
    const { isAdmin } = useUserRole();
    const [cartOpen, setCartOpen] = useState(false);
    const { data: myOrders } = trpc.orders.getMyOrders.useQuery(undefined, {
        staleTime: 60_000,
    });

    const orderCount = myOrders?.length ?? 0;

    return (
        <>
            <header className="flex h-14 shrink-0 items-center justify-between bg-card px-4">
                <AppLink href={isAdmin ? '/' : '/shop'} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ShoppingCart className="h-4 w-4" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">Закупки</span>
                </AppLink>

                <div className="flex items-center gap-1">
                    {session?.user ? (
                        <>
                            <AppLink href="/shop/profile">
                                <Button variant="ghost" size="default" className="gap-1.5">
                                    <User className="h-5 w-5" />
                                    <span className="hidden sm:inline">Профиль</span>
                                </Button>
                            </AppLink>
                            <AppLink href="/shop/orders">
                                <Button variant="ghost" size="default" className="gap-1.5">
                                    <ClipboardList className="h-5 w-5" />
                                    <span className="hidden sm:inline">Заказы</span>
                                </Button>
                            </AppLink>
                            <Button
                                variant="ghost"
                                size="default"
                                className="relative gap-1.5"
                                onClick={() => setCartOpen(true)}
                            >
                                <ShoppingCart className="h-5 w-5" />
                                <span className="hidden sm:inline">Корзина</span>
                                {orderCount > 0 && (
                                    <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                                        {orderCount}
                                    </Badge>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                                onClick={() => {
                                    const base =
                                        process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ??
                                        window.location.origin;
                                    const loginPath = platform ? withPlatformPrefix('/login', platform) : '/login';
                                    void signOut({ callbackUrl: `${base}${loginPath}` });
                                }}
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <AppLink href={platform ? withPlatformPrefix('/login', platform) : '/login'}>
                            <Button variant="outline" size="sm">
                                <LogIn className="mr-2 h-4 w-4" />
                                Войти
                            </Button>
                        </AppLink>
                    )}
                </div>
            </header>

            <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
        </>
    );
}
