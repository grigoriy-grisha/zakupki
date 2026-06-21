'use client';

import { ArrowRightIcon, LayoutDashboardIcon, PackageIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { trpc } from '@/lib/client/trpc';

export default function DashboardPage() {
    const { data: purchases } = trpc.purchases.list.useQuery({ status: 'ACTIVE' });
    const { data: products } = trpc.products.list.useQuery({});

    const activeCount = purchases?.length ?? 0;
    const productCount = products?.length ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Dashboard"
                description="Обзор ваших закупок"
                actions={
                    <Button asChild variant="brand" className="rounded-full">
                        <AppLink href="/purchases">
                            <PlusIcon className="size-4" />
                            Новая закупка
                        </AppLink>
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card rounded="2xl" className="gap-3 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-14-medium text-fg-secondary">Активных закупок</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShoppingCartIcon className="size-4" />
                        </div>
                    </div>
                    <p className="text-36-semibold text-fg-primary tracking-tighter">{activeCount}</p>
                    <Button variant="link" className="h-auto p-0 text-14-medium text-primary" asChild>
                        <AppLink href="/purchases" className="inline-flex items-center gap-1">
                            Перейти к закупкам <ArrowRightIcon className="size-3.5" />
                        </AppLink>
                    </Button>
                </Card>
                <Card rounded="2xl" className="gap-3 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-14-medium text-fg-secondary">Товаров в каталоге</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <PackageIcon className="size-4" />
                        </div>
                    </div>
                    <p className="text-36-semibold text-fg-primary tracking-tighter">{productCount}</p>
                    <Button variant="link" className="h-auto p-0 text-14-medium text-primary" asChild>
                        <AppLink href="/products" className="inline-flex items-center gap-1">
                            Перейти к каталогу <ArrowRightIcon className="size-3.5" />
                        </AppLink>
                    </Button>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card rounded="2xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Активные закупки</CardTitle>
                        <StatusBadge status="active" />
                    </CardHeader>
                    <CardContent>
                        {activeCount === 0 ? (
                            <EmptyState
                                icon={LayoutDashboardIcon}
                                title="Пока нет активных закупок"
                                description="Создайте первую закупку, чтобы начать собирать заказы участников"
                                actionLabel="Создать закупку"
                                onAction={() => (window.location.href = '/purchases')}
                            />
                        ) : (
                            <ul className="flex flex-col gap-1.5">
                                {purchases?.map((p) => (
                                    <li key={p.id}>
                                        <AppLink
                                            href={`/purchases/${p.id}`}
                                            className="group flex items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3 text-14-medium text-fg-primary transition-colors hover:bg-bg-soft"
                                        >
                                            <span className="truncate">{p.tag}</span>
                                            <ArrowRightIcon className="size-4 text-fg-tertiary transition-transform group-hover:translate-x-0.5" />
                                        </AppLink>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card rounded="2xl">
                    <CardHeader>
                        <CardTitle>Быстрые действия</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Button variant="outline" size="lg" asChild className="justify-start rounded-xl">
                            <AppLink href="/products">
                                <PackageIcon className="mr-2 size-4" />
                                Каталог товаров
                            </AppLink>
                        </Button>
                        <Button variant="outline" size="lg" asChild className="justify-start rounded-xl">
                            <AppLink href="/shop">
                                <ShoppingCartIcon className="mr-2 size-4" />
                                Мои закупки (участник)
                            </AppLink>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
