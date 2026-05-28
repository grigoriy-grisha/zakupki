'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LayoutDashboard, Package, ShoppingCart, Users, ShoppingBag, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, admin: true },
    { href: '/purchases', label: 'Закупки', icon: ShoppingCart, admin: true },
    { href: '/products', label: 'Каталог товаров', icon: Package, admin: true },
    { href: '/users', label: 'Участники', icon: Users, admin: true },
    { href: '/settings', label: 'Настройки', icon: Settings, admin: true },
    { href: '/shop', label: 'Мои закупки', icon: ShoppingBag, admin: false },
];

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'ADMIN';
    const items = isAdmin ? navItems : navItems.filter((n) => !n.admin);

    function isActive(href: string) {
        if (href === '/') return pathname === '/';
        return pathname === href || pathname.startsWith(href + '/');
    }

    return (
        <aside className="flex h-screen w-64 flex-col border-r bg-card">
            <div className="flex h-14 items-center px-5">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ShoppingCart className="h-4 w-4" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">Закупки</span>
                </div>
            </div>

            <Separator />

            <nav className="flex-1 space-y-1 p-3">
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {isAdmin ? 'Навигация' : 'Меню'}
                </p>
                {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
                            {item.label}
                            {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                        </Link>
                    );
                })}
            </nav>

            <Separator />
            {session?.user && (
                <div className="p-3">
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                        <Link
                            href="/profile"
                            className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                        >
                            <Avatar>
                                <AvatarImage src={session.user.image ?? undefined} alt="" />
                                <AvatarFallback>{session.user.name?.[0] ?? 'U'}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium truncate">{session.user.name}</p>
                        </Link>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground"
                            onClick={() => {
                                const base =
                                    process.env.NEXT_PUBLIC_VK_REDIRECT_URL?.replace(/\/$/, '') ??
                                    window.location.origin;
                                void signOut({ callbackUrl: `${base}/login` });
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </aside>
    );
}
