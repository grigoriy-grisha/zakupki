'use client';

import { ArrowLeft, Paperclip, ShieldCheck, Unlink } from 'lucide-react';
import type { ReactNode } from 'react';

import { AppLink } from '@/components/app-link';
import { TelegramIcon, VkIcon } from '@/components/icons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useTgAuth } from '@/lib/hooks/use-tg-auth';
import { useVkAuth } from '@/lib/hooks/use-vk-auth';
import { cn } from '@/lib/utils';

interface AccountPanelProps {
    icon: ReactNode;
    linked: boolean;
    avatarUrl?: string | null;
    details?: ReactNode;
    onLink: () => void;
    linkLabel: string;
    onUnlink: () => void;
    canUnlink: boolean;
    loading: boolean;
    tone: 'secondary' | 'primary';
}

function AccountPanel({
    icon,
    linked,
    avatarUrl,
    details,
    onLink,
    linkLabel,
    onUnlink,
    canUnlink,
    loading,
    tone,
}: AccountPanelProps) {
    return (
        <section
            className={cn(
                'flex flex-col gap-4 rounded-2xl border-2 p-4 sm:p-5',
                tone === 'secondary' ? 'border-secondary' : 'border-primary',
            )}
        >
            <div
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border-2',
                    tone === 'secondary' ? 'border-secondary text-secondary' : 'border-primary text-primary',
                )}
            >
                {icon}
            </div>

            {linked ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar src={avatarUrl} className="size-11" iconClassName="size-4" />
                        <div className="flex min-w-0 flex-col">
                            <p className="flex items-center gap-1.5 text-14-medium text-fg-primary">
                                <span className="size-2 rounded-full bg-success" />
                                Привязан
                            </p>
                            <div className="mt-0.5 flex min-w-0 flex-col text-12-regular text-fg-tertiary">
                                {details}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1.5 rounded-full text-fg-primary"
                        onClick={onUnlink}
                        disabled={loading || !canUnlink}
                        title={!canUnlink ? 'Нельзя отвязать единственный способ входа' : undefined}
                    >
                        <Unlink className="size-3.5" />
                        Отвязать
                    </Button>
                </div>
            ) : (
                <Button className="h-10 w-full rounded-full sm:mx-auto sm:w-72" onClick={onLink} disabled={loading}>
                    <Paperclip className="size-4" />
                    {linkLabel}
                </Button>
            )}
        </section>
    );
}

export default function ProfilePage() {
    const { data: user, isLoading } = trpc.users.me.useQuery();
    const vk = useVkAuth();
    const tg = useTgAuth();

    if (isLoading || !user) {
        return (
            <div className="flex flex-col gap-6 sm:gap-8">
                <Skeleton className="h-9 w-64 rounded-2xl sm:h-12" />
                <Skeleton className="h-64 rounded-2xl sm:h-80" />
            </div>
        );
    }

    const canUnlinkVk = !!user.telegramCredential;
    const canUnlinkTg = !!user.vkCredential;

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-3 sm:gap-4">
                <Button variant="ghost" size="sm" asChild className="-ml-2 self-start text-fg-secondary">
                    <AppLink href="/shop">
                        <ArrowLeft className="size-4" />
                        Назад
                    </AppLink>
                </Button>
                <h1 className="text-h1 text-secondary">Личный кабинет</h1>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl bg-bg-soft p-4 sm:gap-5 sm:p-6">
                <section className="flex items-center gap-4 rounded-2xl border-2 border-secondary p-4 sm:p-5">
                    <UserAvatar
                        src={user.avatarUrl}
                        className="size-14 sm:size-16"
                        iconClassName="size-6 sm:size-8"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-display text-18-bold leading-tight text-fg-primary sm:text-24-bold">
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
                            <p className="text-13-regular text-fg-tertiary">@{user.username}</p>
                        )}
                    </div>
                </section>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <AccountPanel
                        icon={<VkIcon className="size-4" />}
                        tone="secondary"
                        linked={!!user.vkCredential}
                        avatarUrl={user.vkCredential?.avatarUrl}
                        details={
                            <span className="tabular-nums">VK ID: {user.vkCredential?.vkId}</span>
                        }
                        onLink={vk.linkVk}
                        linkLabel="Привязать VK"
                        onUnlink={vk.unlinkVk}
                        canUnlink={canUnlinkVk}
                        loading={vk.loading}
                    />

                    <AccountPanel
                        icon={<TelegramIcon className="size-4" />}
                        tone="primary"
                        linked={!!user.telegramCredential}
                        avatarUrl={user.telegramCredential?.avatarUrl}
                        details={
                            <>
                                {(user.telegramCredential?.username ?? user.username) && (
                                    <span className="truncate">
                                        @{user.telegramCredential?.username ?? user.username}
                                    </span>
                                )}
                                <span className="tabular-nums">TG ID: {user.telegramCredential?.telegramId}</span>
                            </>
                        }
                        onLink={tg.linkTg}
                        linkLabel="Привязать Telegram"
                        onUnlink={tg.unlinkTg}
                        canUnlink={canUnlinkTg}
                        loading={tg.loading}
                    />
                </div>
            </div>
        </div>
    );
}
