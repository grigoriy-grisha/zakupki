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

    const push = useCallback((path: string) => router.push(resolvePath(path)), [router, resolvePath]);
    const replace = useCallback((path: string) => router.replace(resolvePath(path)), [router, resolvePath]);
    const back = useCallback(() => router.back(), [router]);
    const refresh = useCallback(() => router.refresh(), [router]);

    return { push, replace, back, refresh };
}
