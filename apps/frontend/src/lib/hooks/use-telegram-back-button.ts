'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { hasInAppBack } from '@/lib/app-history';

import { usePlatform } from './use-platform';

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
