'use client';

import * as VKID from '@vkid/sdk';
import { signIn } from 'next-auth/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useProviderUnlink } from '@/lib/hooks/use-provider-unlink';
import { exchangeVkCode, initVkId } from '@/lib/vk-id';

export function useVkAuth() {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const linkProvider = trpc.users.linkProvider.useMutation();
    const { unlink: unlinkVk, loading, setLoading } = useProviderUnlink('vk');
    const [loginLoading, setLoginLoading] = useState(false);

    const loginWithVk = useCallback(async () => {
        setLoginLoading(true);
        try {
            initVkId();
            const payload = await VKID.Auth.login();
            const accessToken = await exchangeVkCode(payload);
            const result = await signIn('vk', {
                data: JSON.stringify({ accessToken }),
                redirect: false,
            });

            if (result?.ok) {
                router.push('/');
                router.refresh();
            } else {
                toast.error('Не удалось войти через VK');
            }
        } catch (e) {
            const code = (e as { code?: number }).code;
            if (code !== VKID.AuthErrorCode.NewTabHasBeenClosed) {
                toast.error('Не удалось войти через VK');
            }
        } finally {
            setLoginLoading(false);
        }
    }, [router]);

    const linkVk = useCallback(async () => {
        setLoading(true);
        try {
            initVkId();

            const floating = new VKID.FloatingOneTap();
            floating
                .render({ appName: 'Закупки', showAlternativeLogin: true })
                .on(VKID.WidgetEvents.ERROR, () => setLoading(false))
                .on(VKID.FloatingOneTapInternalEvents.LOGIN_SUCCESS, async (payload: unknown) => {
                    const accessToken = await exchangeVkCode(payload);
                    floating.close();

                    linkProvider.mutate(
                        { provider: 'vk', data: JSON.stringify({ accessToken }) },
                        {
                            onSuccess: () => utils.users.me.invalidate(),
                            onError: (err) => toast.error(err.message),
                        },
                    );
                    setLoading(false);
                });
        } catch {
            setLoading(false);
        }
    }, [utils, linkProvider]);

    return { loginWithVk, loginLoading, linkVk, unlinkVk, loading };
}
