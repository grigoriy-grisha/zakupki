'use client';

import { useState } from 'react';

import { trpc } from '@/lib/client/trpc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

import { UserOrdersRow, UserProfileSheet, type UserListItem } from './components';

export default function UsersPage() {
    const { data: users, isLoading } = trpc.users.list.useQuery();
    const [profileUser, setProfileUser] = useState<UserListItem | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Участники</h1>
                    <p className="text-sm text-muted-foreground">
                        {users?.length ?? 0} участников · стрелка — заказы, имя — профиль
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
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12" />
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead>Заказы</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Нет участников
                                        </TableCell>
                                    </TableRow>
                                )}
                                {users?.map((user) => (
                                    <UserOrdersRow
                                        key={user.id}
                                        user={{ ...user, role: user.role ?? 'CLIENT' }}
                                        onOpenProfile={setProfileUser}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <UserProfileSheet
                user={profileUser}
                open={profileUser != null}
                onOpenChange={(open) => {
                    if (!open) setProfileUser(null);
                }}
            />
        </div>
    );
}
