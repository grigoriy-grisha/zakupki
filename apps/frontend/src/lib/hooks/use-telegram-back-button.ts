'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { hasInAppBack } from '@/lib/app-history';

import { usePlatform } from './use-platform';

/**
 * Shows the native Telegram BackButton while there is an in-app page to
 * return to and wires it to router.back(). No-op outside Telegram.
 */
export function useTelegramBackButton(enabled: boolean) {
    const platform = usePlatform();
    const router = useRouter();

    useEffect(() => {
        if (platform !== 'tg') return;
        const backButton = window.Telegram?.WebApp?.BackButton;
        if (!backButton) return;

        const handleBack = () => {
            if (hasInAppBack()) router.back();
        };

        backButton.onClick(handleBack);
        if (enabled) backButton.show();
        else backButton.hide();

        return () => {
            backButton.offClick(handleBack);
            backButton.hide();
        };
    }, [platform, enabled, router]);
}
