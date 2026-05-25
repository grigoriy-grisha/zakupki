'use client';

import * as VKID from '@vkid/sdk';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';

export function useVkAuthorization() {
    const utils = trpc.useUtils();
    const linkProvider = trpc.users.linkProvider.useMutation();
    const unlinkProvider = trpc.users.unlinkProvider.useMutation();
    const [loading, setLoading] = useState(false);

    const linkVk = useCallback(async () => {
        setLoading(true);
        try {
            VKID.Config.init({
                app: Number(process.env.NEXT_PUBLIC_VK_APP_ID),
                redirectUrl: process.env.NEXT_PUBLIC_VK_REDIRECT_URL || window.location.origin,
                responseMode: VKID.ConfigResponseMode.Callback,
                source: VKID.ConfigSource.LOWCODE,
                scope: '',
            });

            const floating = new VKID.FloatingOneTap();
            floating
                .render({ appName: 'Закупки', showAlternativeLogin: true })
                .on(VKID.WidgetEvents.ERROR, () => setLoading(false))
                .on(VKID.FloatingOneTapInternalEvents.LOGIN_SUCCESS, async (payload: unknown) => {
                    const { code, device_id } = payload as { code: string; device_id: string };
                    const vkData = await VKID.Auth.exchangeCode(code, device_id);
                    floating.close();

                    linkProvider.mutate(
                        { provider: 'vk', data: JSON.stringify({ accessToken: vkData.access_token }) },
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

    const unlinkVk = useCallback(async () => {
        setLoading(true);
        try {
            await unlinkProvider.mutateAsync({ provider: 'vk' });
            await utils.users.me.invalidate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка');
        } finally {
            setLoading(false);
        }
    }, [utils, unlinkProvider]);

    return { linkVk, unlinkVk, loading };
}
