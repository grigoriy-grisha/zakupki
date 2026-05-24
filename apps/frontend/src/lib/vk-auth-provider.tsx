'use client';

import * as VKID from '@vkid/sdk';
import { signIn } from 'next-auth/react';
import { useEffect, useRef } from 'react';

import { ROUTES } from '@/lib/constants';

export function VkAuthProvider({ children }: { children: React.ReactNode }) {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;

        const container = document.getElementById('vk-widget');
        if (!container) return;

        initialized.current = true;

        VKID.Config.init({
            app: Number(process.env.NEXT_PUBLIC_VK_APP_ID),
            redirectUrl: process.env.NEXT_PUBLIC_VK_REDIRECT_URL || window.location.origin,
            responseMode: VKID.ConfigResponseMode.Callback,
            source: VKID.ConfigSource.LOWCODE,
            scope: '',
        });

        const oneTap = new VKID.OneTap();
        oneTap
            .render({
                container,
                showAlternativeLogin: true,
                styles: { width: 320, height: 44 },
            })
            .on(VKID.WidgetEvents.ERROR, (e: unknown) => console.error('[VK]', e))
            .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: unknown) => {
                const { code, device_id } = payload as { code: string; device_id: string };
                const vkData = await VKID.Auth.exchangeCode(code, device_id);

                const result = await signIn('vk', {
                    data: JSON.stringify({ accessToken: vkData.access_token }),
                    redirect: false,
                });

                if (result?.ok) {
                    window.location.href = ROUTES.home.path;
                } else {
                    console.error('Auth failed:', result);
                }
            });
    }, []);

    return <>{children}</>;
}
