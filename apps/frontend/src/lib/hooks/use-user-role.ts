'use client';

import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/client/trpc';

export function useUserRole() {
    const { data: session, status } = useSession();
    const isSessionLoading = status === 'loading';
    const hasSession = !!session?.user;

    const { data, isLoading: isQueryLoading, refetch } = trpc.users.getRole.useQuery(undefined, {
        enabled: hasSession,
        staleTime: 1000 * 60 * 5,
    });

    const role = data?.role ?? session?.user?.role ?? 'CLIENT';
    const isAdmin = role === 'ADMIN';
    const isLoading = isSessionLoading || (hasSession && isQueryLoading);

    return {
        role,
        isAdmin,
        isLoading,
        refetch,
    };
}
