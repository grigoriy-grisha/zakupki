'use client';

import { TelegramIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { useTgLogin, useVkLogin } from './hooks';

export default function LoginPage() {
    useVkLogin();
    const tg = useTgLogin();

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold">Закупки</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Войдите, чтобы продолжить</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div id="vk-widget" className="w-full min-h-[44px]" />

                    <Button onClick={tg.login} disabled={tg.loading} variant="outline" size="lg" className="w-full">
                        <TelegramIcon className="mr-2 h-5 w-5" />
                        {tg.loading ? 'Авторизация...' : 'Войти через Telegram'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
