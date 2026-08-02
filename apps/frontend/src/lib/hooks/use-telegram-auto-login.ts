'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { useTelegramWebApp } from './use-telegram-web-app';

export function useTelegramAutoLogin() {
    const { initData, isTelegramWebApp, isLoading: telegramLoading, isMounted } = useTelegramWebApp();
    const { status } = useSession();
    const attempted = useRef(false);
    const [isPending, setIsPending] = useState(false);
    const [loginFailed, setLoginFailed] = useState(false);

    useEffect(() => {
        if (!isMounted || telegramLoading) return;
        if (!isTelegramWebApp || !initData) return;
        if (status !== 'unauthenticated') return;
        if (attempted.current) return;

        attempted.current = true;
        setIsPending(true);

        void signIn('telegram-webapp', { redirect: false, initData }).then((result) => {
            setIsPending(false);
            if (result?.error) setLoginFailed(true);
        });
    }, [isMounted, telegramLoading, isTelegramWebApp, initData, status]);

    return {
        isPending: !isMounted || telegramLoading || isPending,
        loginFailed,
        isTelegramWebApp: isMounted && isTelegramWebApp,
        isAuthenticated: status === 'authenticated',
        isMounted,
    };
}
