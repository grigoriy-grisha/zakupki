'use client';

import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/client/trpc';
import { buildRbac } from '@/lib/rbac-config';

/**
 * User role and RBAC — always from DB via tRPC, never from the session/JWT.
 */
export function useUserRole() {
    const { status } = useSession();
    const isSessionLoading = status === 'loading';
    const hasSession = status === 'authenticated';

    const { data, isLoading: isQueryLoading, refetch } = trpc.users.getRole.useQuery(undefined, {
        enabled: hasSession,
        staleTime: 1000 * 60 * 5,
    });

    const role = data?.role ?? 'CLIENT';
    const isAdmin = role === 'ADMIN';
    const isLoading = isSessionLoading || (hasSession && isQueryLoading);
    const rbac = buildRbac(role);

    return {
        role,
        isAdmin,
        isLoading,
        rbac,
        refetch,
    };
}
