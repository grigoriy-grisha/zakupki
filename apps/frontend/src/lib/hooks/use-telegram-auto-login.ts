'use client';

import { signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { useTelegramWebApp } from './use-telegram-web-app';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

export function useTelegramAutoLogin() {
    const { initData, isTelegramWebApp, isLoading: telegramLoading, isMounted } = useTelegramWebApp();
    const { status } = useSession();
    const [attempt, setAttempt] = useState(0);
    const [isPending, setIsPending] = useState(false);
    const [loginFailed, setLoginFailed] = useState(false);

    useEffect(() => {
        if (!isMounted || telegramLoading) return;
        if (!isTelegramWebApp || !initData) return;
        if (status !== 'unauthenticated') return;
        if (attempt >= MAX_ATTEMPTS) return;

        setIsPending(true);
        const timer = window.setTimeout(
            () => {
                void signIn('telegram-webapp', { redirect: false, initData }).then((result) => {
                    setIsPending(false);
                    if (result?.error) {
                        setLoginFailed(true);
                        setAttempt((n) => n + 1);
                    }
                });
            },
            attempt === 0 ? 0 : RETRY_DELAY_MS,
        );
        return () => window.clearTimeout(timer);
    }, [isMounted, telegramLoading, isTelegramWebApp, initData, status, attempt]);

    const retry = useCallback(() => {
        setLoginFailed(false);
        setAttempt(0);
    }, []);

    return {
        isPending: !isMounted || telegramLoading || isPending,
        loginFailed,
        isTelegramWebApp: isMounted && isTelegramWebApp,
        isAuthenticated: status === 'authenticated',
        isMounted,
        retry,
        attemptsExhausted: attempt >= MAX_ATTEMPTS,
    };
}
