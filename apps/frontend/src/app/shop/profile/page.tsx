'use client';

import { Link2, Unlink, User } from 'lucide-react';

import { TelegramIcon, VkIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/client/trpc';

import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';
export default function ProfilePage() {
    const { data: user } = trpc.users.me.useQuery();
    const vk = useVkAuth();
    const tg = useTgAuth();

    if (!user) return null;

    const canUnlinkVk = !!user.telegramCredential;
    const canUnlinkTg = !!user.vkCredential;

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                    )}
                    <div>
                        <p className="text-xl font-semibold">
                            {user.firstName} {user.lastName ?? ''}
                        </p>
                        {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <VkIcon className="h-5 w-5 text-[#0077FF]" />
                            VK
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user.vkCredential ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.vkCredential.avatarUrl ? (
                                        <img
                                            src={user.vkCredential.avatarUrl}
                                            alt=""
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={vk.unlinkVk}
                                    disabled={vk.loading || !canUnlinkVk}
                                >
                                    <Unlink className="mr-1 h-3 w-3" />
                                    Отвязать
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={vk.linkVk}
                                disabled={vk.loading}
                                className="w-full bg-[#0077FF] text-white hover:bg-[#0066DD]"
                            >
                                <Link2 className="mr-2 h-4 w-4" />
                                Привязать VK
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TelegramIcon className="h-5 w-5 text-[#26A5E4]" />
                            Telegram
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user.telegramCredential ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.telegramCredential.avatarUrl ? (
                                        <img
                                            src={user.telegramCredential.avatarUrl}
                                            alt=""
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
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
                                        {(user.telegramCredential.username ?? user.username) && (
                                            <span className="text-xs text-muted-foreground">
                                                @{user.telegramCredential.username ?? user.username}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            TG ID: {user.telegramCredential.telegramId}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={tg.unlinkTg}
                                    disabled={tg.loading || !canUnlinkTg}
                                >
                                    <Unlink className="mr-1 h-3 w-3" />
                                    Отвязать
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={tg.linkTg} disabled={tg.loading} variant="outline" className="w-full">
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
