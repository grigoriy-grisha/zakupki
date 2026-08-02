'use client';

import { useEffect, useState } from 'react';

export function useTelegramWebApp() {
    const [initData, setInitData] = useState<string | null>(null);
    const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const tg = window.Telegram?.WebApp;
        if (tg?.initData) {
            tg.ready?.();
            tg.expand?.();
            setInitData(tg.initData);
            setIsTelegramWebApp(true);
        }
        setIsLoading(false);
    }, []);

    return { initData, isTelegramWebApp, isLoading, isMounted };
}
