'use client';

import { useEffect, useState } from 'react';

const DETECT_INTERVAL_MS = 250;
const DETECT_MAX_TRIES = 16;

export function useTelegramWebApp() {
    const [initData, setInitData] = useState<string | null>(null);
    const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        let tries = 0;
        const detect = () => {
            const tg = window.Telegram?.WebApp;
            if (tg?.initData) {
                tg.ready?.();
                tg.expand?.();
                setInitData(tg.initData);
                setIsTelegramWebApp(true);
                setIsLoading(false);
                clearInterval(timer);
                return;
            }
            tries += 1;
            if (tries >= DETECT_MAX_TRIES) {
                setIsLoading(false);
                clearInterval(timer);
            }
        };
        detect();
        const timer = window.setInterval(detect, DETECT_INTERVAL_MS);
    }, []);

    return { initData, isTelegramWebApp, isLoading, isMounted };
}
