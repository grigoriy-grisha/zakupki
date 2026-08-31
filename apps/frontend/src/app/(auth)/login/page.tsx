'use client';

import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';

import bgLogin from './assets/bg-login.png';
import bgLoginMobile from './assets/bg-login-mobile.png';
import { LoginForm } from './components/login-form';

export default function LoginPage() {
    const router = useAppRouter();
    const vk = useVkAuth();
    const tg = useTgAuth();
    const { isMounted, isTelegramWebApp, isAuthenticated, isPending, loginFailed } =
        useTelegramAutoLogin();

    useEffect(() => {
        vk.initWidget();
    }, [vk.initWidget]);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/shop');
        }
    }, [isAuthenticated, router]);

    if (!isMounted || (isTelegramWebApp && (isPending || isAuthenticated))) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg-base">
                <Loader2 className="size-6 animate-spin text-fg-tertiary" />
                <p className="text-14-regular text-fg-secondary">
                    {isMounted ? 'Вход через Telegram…' : 'Загрузка…'}
                </p>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg-base p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
            <div aria-hidden className="absolute inset-0">
                <Image
                    src={bgLoginMobile}
                    alt=""
                    fill
                    priority
                    placeholder="blur"
                    sizes="100vw"
                    className="object-cover sm:hidden"
                />
                <Image
                    src={bgLogin}
                    alt=""
                    fill
                    priority
                    placeholder="blur"
                    sizes="100vw"
                    className="hidden object-cover sm:block"
                />
                <div className="absolute inset-0 bg-fg-primary/20" />
            </div>

            <div className="relative w-full max-w-[400px] animate-fade-in-up rounded-4xl border border-white/60 bg-bg-card/50 px-6 py-9 shadow-xl shadow-fg-primary/10 backdrop-blur-2xl backdrop-saturate-150 sm:px-10 sm:py-10">
                <LoginForm
                    onTelegramLogin={tg.login}
                    telegramLoading={tg.loading}
                    autoLoginFailed={loginFailed && isTelegramWebApp}
                />
            </div>
        </div>
    );
}
