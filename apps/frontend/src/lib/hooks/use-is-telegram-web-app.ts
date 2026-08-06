'use client';

import { useEffect, useState } from 'react';

/**
 * Detects whether the app is running inside a Telegram Mini App (WebView).
 *
 * Inside a Mini App `window.Telegram.WebApp.initData` is always populated by
 * Telegram itself. We use it as the source of truth instead of `useSession()`
 * (next-auth), because the session cookie is unreliable in the Telegram WebView
 * — `SameSite=Lax` cookies are frequently dropped, so `useSession()` returns
 * `null` even though the user is effectively authenticated via the `initData`
 * header attached to every tRPC request.
 */
export function useIsTelegramWebApp(): boolean {
    const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);

    useEffect(() => {
        setIsTelegramWebApp(!!window.Telegram?.WebApp?.initData);
    }, []);

    return isTelegramWebApp;
}
