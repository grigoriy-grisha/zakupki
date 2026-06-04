'use client';

import { useState } from 'react';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useSession, signOut } from 'next-auth/react';
import { ShoppingCart, User, LogOut } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';
import { withPlatformPrefix } from '@/lib/app-path';
import { usePlatform } from '@/lib/hooks/use-platform';

import { getCurrentNavLabel, MobileNavTrigger, Sidebar, SidebarBrand } from './sidebar';

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = useAppPathname();
    const { data: session } = useSession();
    const platform = usePlatform();
    const [menuOpen, setMenuOpen] = useState(false);

    const pageTitle = getCurrentNavLabel(pathname, !!session?.user);

    return (
        <div className="flex h-[100dvh] flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between bg-card px-4">
                <div className="flex items-center gap-3">
                    <MobileNavTrigger onClick={() => setMenuOpen(true)} className="md:hidden" />
                    <AppLink href="/" className="flex items-center gap-2">
                        <SidebarBrand />
                    </AppLink>
                </div>

                {session?.user && (
                    <div className="flex items-center gap-1">
                        <AppLink href="/profile">
                            <Button variant="ghost" size="default" className="gap-1.5">
                                <User className="h-5 w-5" />
                                <span className="hidden sm:inline">Профиль</span>
                            </Button>
                        </AppLink>
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
                    </div>
                )}
            </header>

            <div className="flex min-h-0 flex-1">
                <Sidebar className="hidden shrink-0 md:flex" />

                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                    <SheetContent side="left" className="w-64 gap-0 p-0 sm:max-w-xs" showCloseButton={false}>
                        <SheetTitle className="sr-only">Меню навигации</SheetTitle>
                        <Sidebar className="h-full w-full border-0" onNavigate={() => setMenuOpen(false)} />
                    </SheetContent>
                </Sheet>

                <main className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="container mx-auto p-4 md:p-6">{children}</div>
                </main>
            </div>
        </div>
    );
}
