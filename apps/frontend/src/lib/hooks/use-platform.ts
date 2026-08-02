'use client';

import { usePathname } from 'next/navigation';

import { type Platform, parseAppPath } from '@/lib/app-path';

export function usePlatform(): Platform | null {
    const pathname = usePathname();
    return parseAppPath(pathname).platform;
}
