'use client';

import { signIn } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { TelegramIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';

declare global {
    interface Window {
        Telegram?: {
            Login?: {
                auth: (options: { bot_id: number; request_access: boolean }, callback: (user: unknown) => void) => void;
            };
        };
    }
}

export default function LoginPage() {
    const [tgLoading, setTgLoading] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js';
        script.async = true;
        document.head.appendChild(script);
    }, []);

    const handleTgLogin = useCallback(() => {
        if (!window.Telegram?.Login) return;
        setTgLoading(true);

        window.Telegram.Login.auth(
            { bot_id: Number(process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID), request_access: true },
            async (user: unknown) => {
                if (!user) {
                    setTgLoading(false);
                    return;
                }

                try {
                    const result = await signIn('telegram', {
                        data: JSON.stringify(user),
                        redirect: false,
                    });

                    if (result?.ok) {
                        window.location.href = ROUTES.home.path;
                    }
                } catch {
                    // ignore
                }
                setTgLoading(false);
            },
        );
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold">Закупки</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Войдите, чтобы продолжить</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div id="vk-widget" className="w-full min-h-[44px]" />

                    <Button onClick={handleTgLogin} disabled={tgLoading} variant="outline" size="lg" className="w-full">
                        <TelegramIcon className="mr-2 h-5 w-5" />
                        {tgLoading ? 'Авторизация...' : 'Войти через Telegram'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
