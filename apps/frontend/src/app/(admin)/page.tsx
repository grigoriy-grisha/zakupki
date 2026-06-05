'use client';

import { AppLink } from '@/components/app-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Package, Plus, ShoppingCart } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { PageHeader } from './lib/page-header';

export default function DashboardPage() {
    const { data: purchases } = trpc.purchases.list.useQuery({ status: 'ACTIVE' });
    const { data: products } = trpc.products.list.useQuery({});

    const activeCount = purchases?.length ?? 0;
    const productCount = products?.length ?? 0;

    return (
        <div className="space-y-6">
            <PageHeader
                icon={LayoutDashboard}
                title="Dashboard"
                description="Обзор ваших закупок"
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Активных закупок</p>
                        <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{activeCount}</p>
                    <Button variant="link" className="mt-2 h-auto p-0" asChild>
                        <AppLink href="/purchases">Перейти к закупкам</AppLink>
                    </Button>
                </Card>
                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Товаров в каталоге</p>
                        <Package className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{productCount}</p>
                    <Button variant="link" className="mt-2 h-auto p-0" asChild>
                        <AppLink href="/products">Перейти к каталогу</AppLink>
                    </Button>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Активные закупки</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <AppLink href="/purchases/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Новая
                            </AppLink>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {activeCount === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">Нет активных закупок</p>
                        ) : (
                            <ul className="space-y-2">
                                {purchases?.map((p) => (
                                    <li key={p.id}>
                                        <AppLink
                                            href={`/purchases/${p.id}`}
                                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                                        >
                                            <span className="font-medium">{p.tag}</span>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        </AppLink>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Быстрые действия</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Button variant="outline" asChild className="justify-start">
                            <AppLink href="/products">
                                <Package className="mr-2 h-4 w-4" />
                                Каталог товаров
                            </AppLink>
                        </Button>
                        <Button variant="outline" asChild className="justify-start">
                            <AppLink href="/shop">
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Мои закупки (участник)
                            </AppLink>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
