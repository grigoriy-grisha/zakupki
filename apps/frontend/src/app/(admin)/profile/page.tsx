'use client';

import { Link2, Unlink } from 'lucide-react';

import { TelegramIcon, VkIcon } from '@/components/icons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Button } from '@/components/ui/button';
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
        <div className="flex flex-col gap-4 rounded-2xl bg-bg-soft p-4 sm:gap-5 sm:p-6">
            <div className="flex items-center gap-4 rounded-2xl border-2 border-secondary p-4 sm:p-5">
                <UserAvatar src={user.avatarUrl} className="size-14 sm:size-16" iconClassName="size-8" />
                <div className="min-w-0">
                    <p className="truncate font-display text-18-bold leading-tight text-fg-primary sm:text-24-semibold">
                        {user.firstName} {user.lastName ?? ''}
                    </p>
                    {user.username && <p className="text-14-regular text-fg-secondary">@{user.username}</p>}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-4 rounded-2xl border-2 border-secondary p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full border-2 border-secondary text-secondary">
                            <VkIcon className="size-4" />
                        </span>
                        <span className="text-18-semibold text-fg-primary">VK</span>
                    </div>

                    {user.vkCredential ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    src={user.vkCredential.avatarUrl}
                                    className="size-9"
                                    iconClassName="size-4"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-success" />
                                    <span className="text-14-medium">Привязан</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={vk.unlinkVk}
                                disabled={vk.loading || !canUnlinkVk}
                            >
                                <Unlink className="size-3.5" />
                                Отвязать
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={vk.linkVk}
                            disabled={vk.loading}
                            className="h-10 w-full sm:mx-auto sm:w-72"
                        >
                            <Link2 className="size-4" />
                            Привязать VK
                        </Button>
                    )}
                </div>

                <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full border-2 border-primary text-primary">
                            <TelegramIcon className="size-4" />
                        </span>
                        <span className="text-18-semibold text-fg-primary">Telegram</span>
                    </div>

                    {user.telegramCredential ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    src={user.telegramCredential.avatarUrl}
                                    className="size-9"
                                    iconClassName="size-4"
                                />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-success" />
                                        <span className="text-14-medium">Привязан</span>
                                    </div>
                                    {(user.telegramCredential.username ?? user.username) && (
                                        <span className="text-12-regular text-fg-secondary">
                                            @{user.telegramCredential.username ?? user.username}
                                        </span>
                                    )}
                                    <span className="text-12-regular text-fg-secondary">
                                        TG ID: {user.telegramCredential.telegramId}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={tg.unlinkTg}
                                disabled={tg.loading || !canUnlinkTg}
                            >
                                <Unlink className="size-3.5" />
                                Отвязать
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={tg.linkTg}
                            disabled={tg.loading}
                            className="h-10 w-full sm:mx-auto sm:w-72"
                        >
                            <Link2 className="size-4" />
                            Привязать Telegram
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
