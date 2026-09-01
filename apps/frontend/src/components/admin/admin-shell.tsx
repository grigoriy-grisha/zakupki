'use client';

import { LogOutIcon, UserIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { withPlatformPrefix } from '@/lib/app-path';
import { usePlatform } from '@/lib/hooks/use-platform';

import { MobileNavTrigger, Sidebar, SidebarBrand } from './sidebar';

export function AdminShell({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const platform = usePlatform();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="flex h-[100dvh] flex-col bg-bg-base">
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-low bg-bg-base px-4 md:hidden">
                <div className="flex items-center gap-3">
                    <MobileNavTrigger onClick={() => setMenuOpen(true)} />
                    <AppLink href="/" className="flex items-center">
                        <SidebarBrand />
                    </AppLink>
                </div>

                {session?.user && (
                    <div className="flex items-center gap-1">
                        <AppLink href="/profile">
                            <Button variant="ghost" size="icon-sm" className="rounded-full">
                                <UserIcon className="size-4" />
                            </Button>
                        </AppLink>
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
                            <LogOutIcon className="size-4" />
                        </Button>
                    </div>
                )}
            </header>

            <div className="flex min-h-0 flex-1">
                <Sidebar className="hidden md:flex" />

                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                    <SheetContent
                        side="left"
                        className="w-[300px] max-w-[85vw] gap-0 rounded-none border-0 p-0"
                        showCloseButton={false}
                    >
                        <SheetTitle className="sr-only">Меню навигации</SheetTitle>
                        <Sidebar
                            className="h-full w-full border-0"
                            onNavigate={() => setMenuOpen(false)}
                        />
                    </SheetContent>
                </Sheet>

                <main className="min-h-0 flex-1 overflow-y-auto bg-bg-base">
                    {children}
                </main>
            </div>
        </div>
    );
}
