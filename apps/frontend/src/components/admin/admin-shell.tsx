'use client';

import { useEffect, useState } from 'react';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useSession } from 'next-auth/react';
import { ShoppingCart } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

import { getCurrentNavLabel, MobileNavTrigger, Sidebar } from './sidebar';

function MobileHeaderIcon() {
    return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingCart className="h-4 w-4" />
        </div>
    );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = useAppPathname();
    const { data: session } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);

    const isAdmin = session?.user?.role === 'ADMIN';
    const pageTitle = getCurrentNavLabel(pathname, isAdmin);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    return (
        <div className="flex h-[100dvh] flex-col md:flex-row">
            <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
                <MobileNavTrigger onClick={() => setMenuOpen(true)} />
                <MobileHeaderIcon />
                <span className="min-w-0 flex-1 truncate font-semibold">{pageTitle}</span>
            </header>

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
    );
}
