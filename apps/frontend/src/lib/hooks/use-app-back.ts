'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    currentUrl,
    hasInAppBack,
    markPopNavigation,
    recordAppNavigation,
    resetAppHistory,
} from '@/lib/app-history';

import { useAppRouter } from './use-app-router';

/**
 * Tracks in-app soft navigation and reports whether `router.back()` has an
 * in-app entry to return to. Mount once in the shop shell.
 */
export function useAppBackTracker(): boolean {
    const pathname = usePathname();
    const [canGoBack, setCanGoBack] = useState(false);
    const isFirstRunRef = useRef(true);

    useEffect(() => {
        const onPopState = () => markPopNavigation();
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        const url = currentUrl();
        if (isFirstRunRef.current) {
            isFirstRunRef.current = false;
            resetAppHistory(url);
            setCanGoBack(false);
            return;
        }
        recordAppNavigation(url);
        setCanGoBack(hasInAppBack());
    }, [pathname]);

    return canGoBack;
}

/**
 * Back handler for "Назад" buttons: uses real history when the user
 * navigated within the app, falls back to the given href for deep links.
 */
export function useSmartBack(fallbackHref: string) {
    const { back, push } = useAppRouter();

    return useCallback(() => {
        if (hasInAppBack()) back();
        else push(fallbackHref);
    }, [back, push, fallbackHref]);
}
