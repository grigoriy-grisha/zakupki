'use client';

import * as VKID from '@vkid/sdk';
import { signIn } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { Link2, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

declare global {
    interface Window {
        Telegram?: {
            Login?: {
                auth: (options: { bot_id: number; request_access: boolean }, callback: (user: unknown) => void) => void;
            };
        };
    }
}

type LinkedUser = {
    id: number;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
    username: string | null;
    vkId: string | null;
    telegramId: string | null;
    vkAvatarUrl: string | null;
    telegramAvatarUrl: string | null;
};

export default function ProfilePage() {
    const [user, setUser] = useState<LinkedUser | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const refreshUser = useCallback(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => setUser(data.user ?? null));
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    useEffect(() => {
        const existing = document.querySelector('script[src="https://telegram.org/js/telegram-widget.js"]');
        if (!existing) {
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-widget.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handleLinkVk = useCallback(async () => {
        setLoading('vk');
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
                .on(VKID.WidgetEvents.ERROR, () => setLoading(null))
                .on(VKID.FloatingOneTapInternalEvents.LOGIN_SUCCESS, async (payload: unknown) => {
                    const { code, device_id } = payload as { code: string; device_id: string };
                    const vkData = await VKID.Auth.exchangeCode(code, device_id);
                    floating.close();

                    const res = await fetch('/api/auth/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: 'vk', data: JSON.stringify({ accessToken: vkData.access_token }) }),
                    });

                    const result = await res.json();
                    if (result.ok) {
                        refreshUser();
                    } else {
                        toast.error(result.error || 'Ошибка привязки VK');
                    }
                    setLoading(null);
                });
        } catch {
            setLoading(null);
        }
    }, [refreshUser]);

    const handleLinkTg = useCallback(() => {
        if (!window.Telegram?.Login) return;
        setLoading('telegram');

        window.Telegram.Login.auth(
            { bot_id: Number(process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID), request_access: true },
            async (tgUser: unknown) => {
                if (!tgUser) {
                    setLoading(null);
                    return;
                }
                try {
                    const res = await fetch('/api/auth/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: 'telegram', data: JSON.stringify(tgUser) }),
                    });
                    const result = await res.json();
                    if (result.ok) {
                        refreshUser();
                    } else {
                        toast.error(result.error || 'Ошибка привязки Telegram');
                    }
                } catch { /* ignore */ }
                setLoading(null);
            },
        );
    }, [refreshUser]);

    const handleUnlink = useCallback(async (provider: 'vk' | 'telegram') => {
        setLoading(provider);
        await fetch('/api/auth/link', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
        });
        refreshUser();
        setLoading(null);
    }, [refreshUser]);

    if (!user) return null;

    const canUnlinkVk = !!user.telegramId;
    const canUnlinkTg = !!user.vkId;

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
                            {user.firstName[0]}
                        </div>
                    )}
                    <div>
                        <p className="text-xl font-semibold">{user.firstName} {user.lastName ?? ''}</p>
                        {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <svg className="h-5 w-5 text-[#0077FF]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.183 1.815.616.42 1.084.328 1.084.328l2.175-.03s1.14-.07.6-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.265-1.183-1.06.462-3.246.999-1.33 1.398-2.142 1.273-2.489-.119-.332-.854-.244-.854-.244l-2.457.015s-.182-.025-.317.056c-.131.079-.216.263-.216.263s-.387 1.028-.903 1.903c-1.088 1.845-1.524 1.943-1.702 1.828-.413-.267-.31-1.075-.31-1.649 0-1.793.273-2.54-.53-2.733-.266-.064-.462-.106-1.143-.113-.873-.009-1.611.003-2.028.207-.278.136-.493.44-.362.457.162.022.528.099.723.363.251.34.242 1.108.242 1.108s.145 2.111-.337 2.374c-.33.181-.784-.188-1.758-1.877-.499-.863-.876-1.817-.876-1.817s-.073-.178-.203-.274c-.158-.116-.378-.153-.378-.153l-2.335.015s-.35.01-.479.162c-.114.135-.009.414-.009.414s1.824 4.26 3.888 6.406c1.892 1.967 4.042 1.837 4.042 1.837h.974z" />
                            </svg>
                            VK
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user.vkId ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.vkAvatarUrl ? (
                                        <img src={user.vkAvatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                                    ) : (
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0077FF]/10 text-[#0077FF] text-sm font-medium">
                                            VK
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                        <span className="text-sm">Привязан</span>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => handleUnlink('vk')} disabled={loading === 'vk' || !canUnlinkVk}>
                                    <Unlink className="mr-1 h-3 w-3" />
                                    Отвязать
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleLinkVk} disabled={loading === 'vk'} className="w-full bg-[#0077FF] text-white hover:bg-[#0066DD]">
                                <Link2 className="mr-2 h-4 w-4" />
                                Привязать VK
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <svg className="h-5 w-5 text-[#26A5E4]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                            </svg>
                            Telegram
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user.telegramId ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.telegramAvatarUrl ? (
                                        <img src={user.telegramAvatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                                    ) : (
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#26A5E4]/10 text-[#26A5E4] text-sm font-medium">
                                            TG
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                            <span className="text-sm">Привязан</span>
                                        </div>
                                        {user.username && <span className="text-xs text-muted-foreground">@{user.username}</span>}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => handleUnlink('telegram')} disabled={loading === 'telegram' || !canUnlinkTg}>
                                    <Unlink className="mr-1 h-3 w-3" />
                                    Отвязать
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleLinkTg} disabled={loading === 'telegram'} variant="outline" className="w-full">
                                <Link2 className="mr-2 h-4 w-4" />
                                Привязать Telegram
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
