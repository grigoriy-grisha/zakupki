'use client';

import type { ReactNode } from 'react';
import { Link2, ShieldCheck, Unlink } from 'lucide-react';

import { TelegramIcon, VkIcon } from '@/components/icons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';

interface AccountCardProps {
    title: string;
    icon: ReactNode;
    tileClassName: string;
    linked: boolean;
    avatarUrl?: string | null;
    details?: ReactNode;
    onLink: () => void;
    linkLabel: string;
    linkClassName: string;
    onUnlink: () => void;
    canUnlink: boolean;
    loading: boolean;
}

function AccountCard({
    title,
    icon,
    tileClassName,
    linked,
    avatarUrl,
    details,
    onLink,
    linkLabel,
    linkClassName,
    onUnlink,
    canUnlink,
    loading,
}: AccountCardProps) {
    return (
        <Card rounded="2xl" className="gap-0 py-0">
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div
                    className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tileClassName)}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-14-semibold text-fg-primary">{title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-12-regular text-fg-tertiary">
                        {linked && <span className="size-1.5 rounded-full bg-success" />}
                        {linked ? 'Привязан' : 'Не привязан'}
                    </p>
                </div>
                {linked && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-full"
                        onClick={onUnlink}
                        disabled={loading || !canUnlink}
                        title={!canUnlink ? 'Нельзя отвязать единственный способ входа' : undefined}
                    >
                        <Unlink className="size-3" />
                        Отвязать
                    </Button>
                )}
            </div>

            <div className="border-t border-border-soft px-4 py-3.5 sm:px-5">
                {linked ? (
                    <div className="flex items-center gap-3">
                        <UserAvatar src={avatarUrl} className="size-10" iconClassName="size-4" />
                        <div className="flex min-w-0 flex-col gap-0.5">{details}</div>
                    </div>
                ) : (
                    <Button
                        className={cn('h-10 w-full rounded-xl', linkClassName)}
                        onClick={onLink}
                        disabled={loading}
                    >
                        <Link2 className="size-4" />
                        {linkLabel}
                    </Button>
                )}
            </div>
        </Card>
    );
}

export default function ProfilePage() {
    const { data: user, isLoading } = trpc.users.me.useQuery();
    const vk = useVkAuth();
    const tg = useTgAuth();

    if (isLoading || !user) {
        return (
            <div className="flex flex-col gap-5 sm:gap-6">
                <Skeleton className="h-8 w-40 rounded-md" />
                <Skeleton className="h-32 rounded-2xl" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-36 rounded-2xl" />
                    <Skeleton className="h-36 rounded-2xl" />
                </div>
            </div>
        );
    }

    const canUnlinkVk = !!user.telegramCredential;
    const canUnlinkTg = !!user.vkCredential;

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <h1 className="text-24-semibold tracking-tight text-fg-primary sm:text-30-semibold">Профиль</h1>

            <Card rounded="2xl" className="gap-0 py-0">
                <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                    <UserAvatar
                        src={user.avatarUrl}
                        className="size-16 sm:size-20"
                        iconClassName="size-8 sm:size-10"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-20-semibold leading-tight text-fg-primary sm:text-24-semibold">
                                {user.firstName} {user.lastName ?? ''}
                            </h2>
                            {user.role === 'ADMIN' && (
                                <Badge type="subtle" variant="accent" size="sm">
                                    <ShieldCheck className="size-3" />
                                    Администратор
                                </Badge>
                            )}
                        </div>
                        {user.username && (
                            <p className="text-14-regular text-fg-tertiary">@{user.username}</p>
                        )}
                    </div>
                </div>
            </Card>

            <section className="flex flex-col gap-3 sm:gap-4">
                <div>
                    <h3 className="text-16-semibold text-fg-primary sm:text-18-semibold">Связанные аккаунты</h3>
                    <p className="mt-0.5 text-13-regular text-fg-tertiary">
                        Вход в аккаунт через соцсети — отвязывать можно по одной
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <AccountCard
                        title="VK"
                        icon={<VkIcon className="size-4" />}
                        tileClassName="bg-vk/10 text-vk"
                        linked={!!user.vkCredential}
                        avatarUrl={user.vkCredential?.avatarUrl}
                        details={
                            <span className="text-12-regular text-fg-tertiary tabular-nums">
                                VK ID: {user.vkCredential?.vkId}
                            </span>
                        }
                        onLink={vk.linkVk}
                        linkLabel="Привязать VK"
                        linkClassName="bg-vk text-vk-foreground hover:bg-vk/90"
                        onUnlink={vk.unlinkVk}
                        canUnlink={canUnlinkVk}
                        loading={vk.loading}
                    />

                    <AccountCard
                        title="Telegram"
                        icon={<TelegramIcon className="size-4" />}
                        tileClassName="bg-telegram/10 text-telegram"
                        linked={!!user.telegramCredential}
                        avatarUrl={user.telegramCredential?.avatarUrl}
                        details={
                            <>
                                {(user.telegramCredential?.username ?? user.username) && (
                                    <span className="truncate text-12-regular text-fg-tertiary">
                                        @{user.telegramCredential?.username ?? user.username}
                                    </span>
                                )}
                                <span className="text-12-regular text-fg-tertiary tabular-nums">
                                    TG ID: {user.telegramCredential?.telegramId}
                                </span>
                            </>
                        }
                        onLink={tg.linkTg}
                        linkLabel="Привязать Telegram"
                        linkClassName="bg-telegram text-telegram-foreground hover:bg-telegram/90"
                        onUnlink={tg.unlinkTg}
                        canUnlink={canUnlinkTg}
                        loading={tg.loading}
                    />
                </div>
            </section>
        </div>
    );
}
