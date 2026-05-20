'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, Users, ShoppingBag, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const adminNav = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/purchases', label: 'Закупки', icon: ShoppingCart },
    { href: '/products', label: 'Каталог товаров', icon: Package },
    { href: '/users', label: 'Участники', icon: Users },
    { href: '/settings', label: 'Настройки', icon: Settings },
];

const userNav = [
    { href: '/shop', label: 'Мои закупки', icon: ShoppingBag, exact: false },
];

export function Sidebar() {
    const pathname = usePathname();

    function isActive(href: string, exact?: boolean) {
        if (href === '/') return pathname === '/';
        if (exact) return pathname === href;
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
                    Админ
                </p>
                {adminNav.map((item) => {
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

                <Separator className="my-4" />

                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Участник
                </p>
                {userNav.map((item) => {
                    const active = isActive(item.href, item.exact);
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
            <div className="p-3">
                <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary">Совет</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Создайте закупку, добавьте товары и поделитесь ссылкой
                    </p>
                </div>
            </div>
        </aside>
    );
}
