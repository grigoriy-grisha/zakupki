'use client';

import * as VKID from '@vkid/sdk';
import { signIn } from 'next-auth/react';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { trpc } from '@/lib/client/trpc';
import { useProviderUnlink } from '@/lib/hooks/use-provider-unlink';
import { exchangeVkCode, initVkId } from '@/lib/vk-id';
import { toast } from 'sonner';

export function useVkAuth() {
    const router = useAppRouter();
    const utils = trpc.useUtils();
    const linkProvider = trpc.users.linkProvider.useMutation();
    const { unlink: unlinkVk, loading, setLoading } = useProviderUnlink('vk');
    const initialized = useRef(false);

    /** Render VK OneTap widget on login page */
    const renderWidget = useCallback(() => {
        const container = document.getElementById('vk-widget');
        if (!container || initialized.current) return;

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
                        router.push('/');
                        router.refresh();
                    } else {
                        console.error('Auth failed:', result);
                    }
                } catch (e) {
                    console.error('[VK]', e);
                }
            });
    }, [router]);

    /** Use as useEffect on login page */
    const initWidget = useCallback(() => {
        renderWidget();
    }, [renderWidget]);

    /** Link VK to existing account (profile page) */
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

    return { initWidget, linkVk, unlinkVk, loading };
}
