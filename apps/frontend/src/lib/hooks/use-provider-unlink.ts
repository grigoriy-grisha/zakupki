'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';

type AuthProvider = 'vk' | 'telegram';

/** Общая логика отвязки VK / Telegram от профиля. */
export function useProviderUnlink(provider: AuthProvider) {
    const utils = trpc.useUtils();
    const unlinkProvider = trpc.users.unlinkProvider.useMutation();
    const [loading, setLoading] = useState(false);

    const unlink = useCallback(async () => {
        setLoading(true);
        try {
            await unlinkProvider.mutateAsync({ provider });
            await utils.users.me.invalidate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка');
        } finally {
            setLoading(false);
        }
    }, [provider, unlinkProvider, utils.users.me]);

    return { unlink, loading, setLoading };
}
