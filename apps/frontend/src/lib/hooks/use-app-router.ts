'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { withPlatformPrefix } from '@/lib/app-path';

import { usePlatform } from './use-platform';

export function useAppRouter() {
    const router = useRouter();
    const platform = usePlatform();

    const resolvePath = useCallback(
        (path: string) => (platform ? withPlatformPrefix(path, platform) : path),
        [platform],
    );

    return {
        push: (path: string) => router.push(resolvePath(path)),
        replace: (path: string) => router.replace(resolvePath(path)),
        refresh: () => router.refresh(),
    };
}
