'use client';

import { useEffect, useState } from 'react';

const DETECT_INTERVAL_MS = 250;
const DETECT_MAX_TRIES = 16;

/**
 * Detects whether the app is running inside a Telegram Mini App (WebView).
 *
 * Inside a Mini App `window.Telegram.WebApp.initData` is always populated by
 * Telegram itself. We use it as the source of truth instead of `useSession()`
 * (next-auth), because the session cookie is unreliable in the Telegram WebView
 * — `SameSite=Lax` cookies are frequently dropped, so `useSession()` returns
 * `null` even though the user is effectively authenticated via the `initData`
 * header attached to every tRPC request.
 *
 * The telegram-web-app.js script loads after hydration, so the first check can
 * legitimately miss it — poll briefly instead of deciding once.
 */
export function useIsTelegramWebApp(): boolean {
    const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);

    useEffect(() => {
        let tries = 0;
        const detect = () => {
            if (window.Telegram?.WebApp?.initData) {
                setIsTelegramWebApp(true);
                return;
            }
            tries += 1;
            if (tries < DETECT_MAX_TRIES) window.setTimeout(detect, DETECT_INTERVAL_MS);
        };
        detect();
    }, []);

    return isTelegramWebApp;
}
