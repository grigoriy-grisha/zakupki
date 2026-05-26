'use client';

import { useSession } from 'next-auth/react';

import type { RbacConfig } from '@/lib/rbac-config';

export function useIsAuthorized(requiredAccess: (keyof RbacConfig)[]): boolean {
    const { data } = useSession();
    const rbac = data?.user?.rbac;
    return !!rbac && requiredAccess.every((access) => rbac[access]);
}
