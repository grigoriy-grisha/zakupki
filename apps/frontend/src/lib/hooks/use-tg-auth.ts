'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { trpc } from '@/lib/client/trpc';
import { useProviderUnlink } from '@/lib/hooks/use-provider-unlink';
import { toast } from 'sonner';

declare global {
    interface Window {
        Telegram?: {
            Login?: {
                auth: (
                    options: { bot_id: number; request_access: boolean },
                    callback: (user: unknown) => void,
                ) => void;
            };
        };
    }
}

export function useTgAuth() {
    const router = useRouter();
    const utils = trpc.useUtils();
    const linkProvider = trpc.users.linkProvider.useMutation();
    const { unlink: unlinkTg, loading, setLoading } = useProviderUnlink('telegram');

    /** Login via Telegram (auth page) */
    const login = useCallback(() => {
        if (!window.Telegram?.Login) return;
        setLoading(true);

        window.Telegram.Login.auth(
            { bot_id: Number(process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID), request_access: true },
            async (user: unknown) => {
                if (!user) {
                    setLoading(false);
                    return;
                }

                try {
                    const result = await signIn('telegram', {
                        data: JSON.stringify(user),
                        redirect: false,
                    });

                    if (result?.ok) {
                        router.push('/');
                        router.refresh();
                        return;
                    }
                } catch {
                    // ignore
                }
                setLoading(false);
            },
        );
    }, [router]);

    /** Link Telegram to existing account (profile page) */
    const linkTg = useCallback(() => {
        if (!window.Telegram?.Login) return;
        setLoading(true);

        window.Telegram.Login.auth(
            { bot_id: Number(process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID), request_access: true },
            (tgUser: unknown) => {
                if (!tgUser) {
                    setLoading(false);
                    return;
                }
                linkProvider.mutate(
                    { provider: 'telegram', data: JSON.stringify(tgUser) },
                    {
                        onSuccess: () => utils.users.me.invalidate(),
                        onError: (err) => toast.error(err.message),
                    },
                );
                setLoading(false);
            },
        );
    }, [utils, linkProvider]);

    return { login, linkTg, unlinkTg, loading };
}
