'use client';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useEffect } from 'react';

import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';

function LoadingScreen({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
            {message}
        </div>
    );
}

export default function WebAppPage() {
    const router = useAppRouter();
    const { isMounted, isTelegramWebApp, isAuthenticated, isPending, loginFailed } = useTelegramAutoLogin();

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/shop');
        }
    }, [isAuthenticated, router]);

    if (!isMounted || isPending) {
        return <LoadingScreen message="Вход…" />;
    }

    if (!isTelegramWebApp) {
        return <LoadingScreen message="Откройте магазин из Telegram" />;
    }

    if (loginFailed) {
        return <LoadingScreen message="Не удалось войти через Telegram" />;
    }

    return <LoadingScreen message="Переход в магазин…" />;
}
