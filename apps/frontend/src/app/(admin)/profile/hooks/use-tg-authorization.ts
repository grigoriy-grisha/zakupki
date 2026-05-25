'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';

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

export function useTgAuthorization() {
    const utils = trpc.useUtils();
    const linkProvider = trpc.users.linkProvider.useMutation();
    const unlinkProvider = trpc.users.unlinkProvider.useMutation();
    const [loading, setLoading] = useState(false);

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

    const unlinkTg = useCallback(async () => {
        setLoading(true);
        try {
            await unlinkProvider.mutateAsync({ provider: 'telegram' });
            await utils.users.me.invalidate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка');
        } finally {
            setLoading(false);
        }
    }, [utils, unlinkProvider]);

    return { linkTg, unlinkTg, loading };
}
