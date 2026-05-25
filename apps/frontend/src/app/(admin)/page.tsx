'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, LayoutDashboard, TrendingUp } from 'lucide-react';

import {
    DASHBOARD_ORDER_STATUS_CONFIG,
    DASHBOARD_RECENT_ORDERS,
    DASHBOARD_RECENT_PURCHASES,
    DASHBOARD_STATS,
} from './lib/constants';

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
                {DASHBOARD_STATS.map((stat) => (
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

            <div className="grid gap-6 lg:grid-cols-5">
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
                                {DASHBOARD_RECENT_ORDERS.map((order) => {
                                    const sc = DASHBOARD_ORDER_STATUS_CONFIG[order.status];
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

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Активные закупки</CardTitle>
                        <p className="text-sm text-muted-foreground">Текущие закупки и их прогресс</p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {DASHBOARD_RECENT_PURCHASES.map((purchase) => (
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
