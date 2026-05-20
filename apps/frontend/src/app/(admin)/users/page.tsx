'use client';

import { trpc } from '@/lib/client/trpc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';
import { UserOrdersRow } from './components';

export default function UsersPage() {
    const { data: users, isLoading } = trpc.users.list.useQuery();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Участники</h1>
                    <p className="text-sm text-muted-foreground">
                        {users?.length ?? 0} участников · нажмите на строку для просмотра заказов
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12" />
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Заказы</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            Нет участников
                                        </TableCell>
                                    </TableRow>
                                )}
                                {users?.map((user) => {
                                    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
                                    return <UserOrdersRow key={user.id} userId={user.id} userName={name} />;
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
