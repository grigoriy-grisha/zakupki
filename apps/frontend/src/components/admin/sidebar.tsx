'use client';

import { useState } from 'react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    LayoutDashboardIcon,
    MenuIcon,
    PackageIcon,
    SettingsIcon,
    ShoppingCartIcon,
    UsersIcon,
} from 'lucide-react';
import Link from 'next/link';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { useSidebarCollapsed } from '@/lib/client/use-sidebar-collapsed';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { isNavActive, withPlatformPrefix } from '@/lib/app-path';
import { cn } from '@/lib/utils';

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    admin?: boolean;
};

const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon, admin: true },
    { href: '/purchases', label: 'Закупки', icon: ShoppingCartIcon, admin: true },
    { href: '/products', label: 'Каталог товаров', icon: PackageIcon, admin: true },
    { href: '/users', label: 'Участники', icon: UsersIcon, admin: true },
    { href: '/settings', label: 'Настройки', icon: SettingsIcon, admin: true },
];

function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
    return (
        <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingCartIcon className="size-4" />
            </div>
            {!collapsed && (
                <span className="truncate text-18-semibold text-fg-primary tracking-tight">Закупки</span>
            )}
        </div>
    );
}

type SidebarProps = {
    className?: string;
    onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
    const appPathname = useAppPathname();
    const { isAdmin } = useUserRole();
    const { collapsed, toggle, closeMobile } = useSidebarCollapsed();
    const [hovered, setHovered] = useState(false);
    const items = isAdmin ? navItems : navItems.filter((n) => !n.admin);

    return (
        <aside
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                'group flex h-full shrink-0 flex-col bg-bg-base transition-[width] duration-200 ease-in-out',
                collapsed ? 'w-[52px]' : 'w-[220px]',
                className,
            )}
        >
            <div className="flex h-14 items-center justify-between gap-1 px-2.5">
                {collapsed ? (
                    <Link
                        href="/"
                        className="flex h-9 w-9 items-center justify-center"
                        onClick={() => {
                            onNavigate?.();
                            closeMobile();
                        }}
                    >
                        <SidebarBrand collapsed />
                    </Link>
                ) : (
                    <AppLink
                        href="/"
                        onClick={() => {
                            onNavigate?.();
                            closeMobile();
                        }}
                        className="flex h-9 items-center"
                    >
                        <SidebarBrand />
                    </AppLink>
                )}
                {!collapsed && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggle}
                        aria-label="Свернуть меню"
                        className={cn(
                            'shrink-0 rounded-full transition-opacity',
                            hovered ? 'opacity-100' : 'opacity-0',
                        )}
                    >
                        <ChevronLeftIcon className="size-4 text-fg-secondary" />
                    </Button>
                )}
            </div>

            {collapsed && (
                <div className="flex justify-center pb-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggle}
                        aria-label="Развернуть меню"
                        className="rounded-full"
                    >
                        <ChevronRightIcon className="size-4 text-fg-secondary" />
                    </Button>
                </div>
            )}

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
                {items.map((item) => {
                    const active = isNavActive(appPathname, item.href);
                    const Icon = item.icon;
                    return (
                        <AppLink
                            key={item.href}
                            href={item.href}
                            onClick={() => {
                                onNavigate?.();
                                closeMobile();
                            }}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                'flex h-9 items-center rounded-full transition-colors',
                                collapsed ? 'w-9 justify-center px-0' : 'gap-2 px-3',
                                active
                                    ? 'bg-bg-soft text-fg-primary'
                                    : 'text-fg-secondary hover:bg-bg-soft hover:text-fg-primary',
                            )}
                        >
                            <Icon className="size-4 shrink-0" />
                            {!collapsed && <span className="text-14-medium">{item.label}</span>}
                        </AppLink>
                    );
                })}
            </nav>
        </aside>
    );
}

export function MobileNavTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn('shrink-0 rounded-full', className)}
            onClick={onClick}
            aria-label="Меню"
        >
            <MenuIcon className="size-4" />
        </Button>
    );
}

export { SidebarBrand };

export function getCurrentNavLabel(pathname: string, isAdmin: boolean): string {
    const items = isAdmin ? navItems : navItems.filter((n) => !n.admin);
    const match = items.find((item) => isNavActive(pathname, item.href));
    return match?.label ?? 'Закупки';
}
