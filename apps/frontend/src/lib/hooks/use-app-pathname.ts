'use client';

import { usePathname } from 'next/navigation';

import { parseAppPath } from '@/lib/app-path';

export function useAppPathname(): string {
    const pathname = usePathname();
    return parseAppPath(pathname).pathname;
}
