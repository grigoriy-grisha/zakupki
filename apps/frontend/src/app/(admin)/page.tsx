'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Clock,
    ArrowRight,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';

const stats = [
    { title: 'Активных закупок', value: '3', icon: ShoppingCart, change: '+1 за неделю' },
    { title: 'Участников', value: '24', icon: Users, change: '+5 за неделю' },
    { title: 'Товаров в каталоге', value: '156', icon: Package, change: '+12 за неделю' },
    { title: 'Ожидают оплаты', value: '8', icon: AlertCircle, change: 'На сумму 45 000 ₽' },
];

const recentOrders = [
    { id: 1, user: 'Анна К.', product: 'MIYUKI 11/0 Black', quantity: '50г', amount: '6 000 ₽', date: 'Вчера', status: 'new' },
    { id: 2, user: 'Мария С.', product: 'TOHO 15/0 Gold', quantity: '30г', amount: '5 400 ₽', date: 'Вчера', status: 'confirmed' },
    { id: 3, user: 'Елена П.', product: 'Чехия 2 мм Кристалл', quantity: '100 шт', amount: '2 500 ₽', date: '2 дня', status: 'paid' },
    { id: 4, user: 'Ольга В.', product: 'Нитка Fireline 4lb', quantity: '20 м', amount: '1 800 ₽', date: '3 дня', status: 'new' },
    { id: 5, user: 'Татьяна Р.', product: 'Мионо 0,3мм', quantity: '50 м', amount: '1 200 ₽', date: '4 дня', status: 'confirmed' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    new: { label: 'Новый', variant: 'default' },
    confirmed: { label: 'Подтверждён', variant: 'secondary' },
    paid: { label: 'Оплачен', variant: 'outline' },
};

const recentPurchases = [
    { id: 1, tag: '#СЗ7', title: 'Бисер MIYUKI', status: 'ACTIVE', deadline: '15 июня', progress: 85, items: 12, orders: 24, amount: '185 000 ₽', color: 'bg-claude-terracotta' },
    { id: 2, tag: '#СЗ8', title: 'Чешские кристаллы', status: 'ACTIVE', deadline: '20 июня', progress: 62, items: 8, orders: 18, amount: '92 000 ₽', color: 'bg-claude-purple' },
    { id: 3, tag: '#СЗ9', title: 'Нити и леска', status: 'DRAFT', deadline: '25 июня', progress: 0, items: 5, orders: 0, amount: '0 ₽', color: 'bg-muted-foreground/50' },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Обзор ваших закупок</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <stat.icon className="h-4 w-4 text-primary" />
                            </div>
                        </div>
                        <p className="mt-2 text-3xl font-bold">{stat.value}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                            <TrendingUp className="mr-1 inline h-3 w-3" />
                            {stat.change}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Recent Orders */}
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Последние заказы</CardTitle>
                            <p className="text-sm text-muted-foreground">Новые заказы участников</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/purchases">
                                Все заказы
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Пользователь</TableHead>
                                    <TableHead>Товар</TableHead>
                                    <TableHead>Кол-во</TableHead>
                                    <TableHead>Сумма</TableHead>
                                    <TableHead>Статус</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentOrders.map((order) => {
                                    const sc = statusConfig[order.status];
                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                                        {order.user.charAt(0)}
                                                    </div>
                                                    <span className="font-medium">{order.user}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{order.product}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{order.quantity}</TableCell>
                                            <TableCell className="font-medium">{order.amount}</TableCell>
                                            <TableCell>
                                                <Badge variant={sc.variant}>{sc.label}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Active Purchases */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Активные закупки</CardTitle>
                        <p className="text-sm text-muted-foreground">Текущие закупки и их прогресс</p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {recentPurchases.map((purchase) => (
                            <Link key={purchase.id} href={`/purchases/${purchase.id}`}>
                                <div className="group rounded-xl border p-4 transition-colors hover:border-primary/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ${purchase.color}`} />
                                            <span className="font-semibold">{purchase.tag}</span>
                                        </div>
                                        <Badge
                                            variant={purchase.status === 'ACTIVE' ? 'default' : 'secondary'}
                                            className={purchase.status === 'ACTIVE' ? 'bg-success-50 text-success pointer-events-none' : 'pointer-events-none'}
                                        >
                                            {purchase.status === 'ACTIVE' ? 'Активна' : 'Черновик'}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm font-medium group-hover:text-primary transition-colors">{purchase.title}</p>
                                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            До {purchase.deadline}
                                        </span>
                                        <span>{purchase.items} тов.</span>
                                        <span>{purchase.orders} заказов</span>
                                    </div>
                                    {purchase.progress > 0 && (
                                        <>
                                            <div className="mt-3 h-2 rounded-full bg-secondary">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${purchase.progress >= 80 ? 'bg-success' : purchase.progress >= 50 ? 'bg-primary' : 'bg-warning'}`}
                                                    style={{ width: `${purchase.progress}%` }}
                                                />
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Прогресс</span>
                                                <span className="font-medium">{purchase.progress}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
