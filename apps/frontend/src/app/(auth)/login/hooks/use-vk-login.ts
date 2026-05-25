'use client';

import * as VKID from '@vkid/sdk';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { ROUTES } from '@/lib/constants';
import { exchangeVkCode, initVkId } from '@/lib/vk-id';

export function useVkLogin() {
    const router = useRouter();
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;

        const container = document.getElementById('vk-widget');
        if (!container) return;

        initialized.current = true;
        initVkId();

        const oneTap = new VKID.OneTap();
        oneTap
            .render({
                container,
                showAlternativeLogin: true,
                styles: { width: 320, height: 44 },
            })
            .on(VKID.WidgetEvents.ERROR, (e: unknown) => console.error('[VK]', e))
            .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: unknown) => {
                try {
                    const accessToken = await exchangeVkCode(payload);
                    const result = await signIn('vk', {
                        data: JSON.stringify({ accessToken }),
                        redirect: false,
                    });

                    if (result?.ok) {
                        router.push(ROUTES.home.path);
                        router.refresh();
                    } else {
                        console.error('Auth failed:', result);
                    }
                } catch (e) {
                    console.error('[VK]', e);
                }
            });
    }, [router]);
}
