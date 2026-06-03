'use client';

import { useSession, signOut } from 'next-auth/react';
import {
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Settings,
    ShoppingBag,
    ShoppingCart,
    Users,
} from 'lucide-react';

import { useUserRole } from '@/lib/hooks/use-user-role';

import { AppLink } from '@/components/app-link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { isNavActive, withPlatformPrefix } from '@/lib/app-path';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { usePlatform } from '@/lib/hooks/use-platform';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, admin: true },
    { href: '/purchases', label: 'Закупки', icon: ShoppingCart, admin: true },
    { href: '/products', label: 'Каталог товаров', icon: Package, admin: true },
    { href: '/users', label: 'Участники', icon: Users, admin: true },
    { href: '/settings', label: 'Настройки', icon: Settings, admin: true },
];

export function SidebarBrand() {
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingCart className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Закупки</span>
        </div>
    );
}

type SidebarProps = {
    className?: string;
    onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
    const appPathname = useAppPathname();
    const platform = usePlatform();
    const { data: session } = useSession();
    const { isAdmin } = useUserRole();
    const items = isAdmin ? navItems : navItems.filter((n) => !n.admin);

    return (
        <aside className={cn('flex h-full w-64 flex-col border-r bg-card', className)}>
            <div className="flex h-14 items-center px-5">
                <SidebarBrand />
            </div>

            <Separator />

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {isAdmin ? 'Навигация' : 'Меню'}
                </p>
                {items.map((item) => {
                    const active = isNavActive(appPathname, item.href);
                    return (
                        <AppLink
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                            {item.label}
                            {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                        </AppLink>
                    );
                })}
            </nav>

            <Separator />

            {session?.user && (
                <div className="p-3">
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                        <AppLink
                            href="/profile"
                            onClick={onNavigate}
                            className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
                        >
                            <Avatar>
                                <AvatarImage src={session.user.image ?? undefined} alt="" />
                                <AvatarFallback>{session.user.name?.[0] ?? 'U'}</AvatarFallback>
                            </Avatar>
                            <p className="truncate text-sm font-medium">{session.user.name}</p>
                        </AppLink>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground"
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
                    </div>
                </div>
            )}
        </aside>
    );
}

export function MobileNavTrigger({ onClick }: { onClick: () => void }) {
    return (
        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClick} aria-label="Меню">
            <Menu className="h-5 w-5" />
        </Button>
    );
}

export function getCurrentNavLabel(pathname: string, isAdmin: boolean): string {
    const items = isAdmin ? navItems : navItems.filter((n) => !n.admin);
    const match = items.find((item) => isNavActive(pathname, item.href));
    return match?.label ?? 'Закупки';
}
