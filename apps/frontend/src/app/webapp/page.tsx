'use client';

import { useEffect } from 'react';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { parseTelegramStartParam, shopPathForStartTarget } from '@/lib/telegram-start-param';

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
            const target = parseTelegramStartParam(window.Telegram?.WebApp?.initDataUnsafe?.start_param);
            router.replace(target ? shopPathForStartTarget(target) : '/shop');
        }
    }, [isAuthenticated, router]);

    if (!isMounted || isPending) {
        return <LoadingScreen message="Вход…" />;
    }

    if (!isTelegramWebApp) {
        return <LoadingScreen message="Откройте приложение из Telegram" />;
    }

    if (loginFailed) {
        return <LoadingScreen message="Не удалось войти через Telegram" />;
    }

    return <LoadingScreen message="Переход в приложение…" />;
}
