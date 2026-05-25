'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ROUTES } from '@/lib/constants';

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

export function useTgLogin() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

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
                        router.push(ROUTES.home.path);
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

    return { login, loading };
}
