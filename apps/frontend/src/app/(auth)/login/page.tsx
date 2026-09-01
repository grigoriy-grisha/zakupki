'use client';

import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useTelegramAutoLogin } from '@/lib/hooks/use-telegram-auto-login';
import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';
import { isVkConfigured } from '@/lib/vk-id';

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
        <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg-base p-4 pb-14 sm:p-6 sm:pb-9">
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
            </div>

            <div className="relative w-full max-w-[264px] sm:max-w-[284px]">
                <LoginForm
                    onTelegramLogin={tg.login}
                    telegramLoading={tg.loading}
                    onVkLogin={vk.loginWithVk}
                    vkLoading={vk.loginLoading}
                    showVkButton={isVkConfigured()}
                    autoLoginFailed={loginFailed && isTelegramWebApp}
                />
            </div>
        </div>
    );
}
