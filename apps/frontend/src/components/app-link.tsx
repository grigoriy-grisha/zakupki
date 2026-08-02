'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

import { withPlatformPrefix } from '@/lib/app-path';
import { usePlatform } from '@/lib/hooks/use-platform';

type AppLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    href: string;
};

export function AppLink({ href, ...props }: AppLinkProps) {
    const platform = usePlatform();
    const resolvedHref = platform ? withPlatformPrefix(href, platform) : href;
    return <Link href={resolvedHref} {...props} />;
}
