'use client';

import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';

import { type UserListItem,UserOrdersRow, UserProfileSheet } from './components';

export default function UsersPage() {
    const { data: users, isLoading } = trpc.users.list.useQuery();
    const [profileUser, setProfileUser] = useState<UserListItem | null>(null);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Участники"
                description={`${users?.length ?? 0} участников · стрелка — закупки, имя — профиль`}
            />

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : (
                <Card className="py-0">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12" />
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead>Согласие ПД</TableHead>
                                    <TableHead>Закупки</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-fg-secondary">
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
