'use client';

import { useEffect } from 'react';

import { LogoIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';
import { TelegramIcon } from '@/components/icons';

export default function LoginPage() {
    const router = useAppRouter();
    const vk = useVkAuth();
    const tg = useTgAuth();
    const { isMounted, isTelegramWebApp, isAuthenticated, isPending } = useTelegramAutoLogin();

    useEffect(() => {
        vk.initWidget();
    }, [vk.initWidget]);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/shop');
        }
    }, [isAuthenticated, router]);

    if (!isMounted) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center text-14-regular text-fg-secondary">
                Загрузка…
            </div>
        );
    }

    if (isTelegramWebApp && (isPending || isAuthenticated)) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center text-14-regular text-fg-secondary">
                Вход через Telegram…
            </div>
        );
    }

    return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-bg-base p-2 md:p-6">
            <div className="w-full max-w-md rounded-4xl border border-border bg-bg-card p-8 shadow-md md:p-10">
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <LogoIcon size={28} className="text-primary" />
                    </div>
                    <h1 className="text-30-semibold tracking-tight text-fg-primary">Закупки</h1>
                    <p className="mt-1 text-14-regular text-fg-secondary">Войдите, чтобы продолжить</p>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div id="vk-widget" className="w-full min-h-[44px]" />

                    <Button
                        onClick={tg.login}
                        disabled={tg.loading}
                        variant="outline"
                        size="lg"
                        className="w-full rounded-full text-14-medium"
                    >
                        <TelegramIcon className="mr-2 size-4" />
                        {tg.loading ? 'Авторизация...' : 'Войти через Telegram'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
