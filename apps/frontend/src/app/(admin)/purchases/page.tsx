'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PurchaseCard } from './components';

export default function PurchasesPage() {
    const [tab, setTab] = useState('all');

    const { data: purchases, isLoading } = trpc.purchases.list.useQuery(tab === 'all' ? undefined : { status: tab });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold tracking-tight">Закупки</h1>
                <Button asChild>
                    <Link href="/purchases/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Новая закупка
                    </Link>
                </Button>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="all">Все</TabsTrigger>
                    <TabsTrigger value="DRAFT">Черновики</TabsTrigger>
                    <TabsTrigger value="ACTIVE">Активные</TabsTrigger>
                    <TabsTrigger value="DONE">Завершённые</TabsTrigger>
                </TabsList>

                <TabsContent value={tab} className="mt-4">
                    {isLoading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-40" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {purchases?.length === 0 && (
                                <p className="col-span-full py-12 text-center text-muted-foreground">Нет закупок</p>
                            )}
                            {purchases?.map((purchase) => (
                                <PurchaseCard key={purchase.id} purchase={purchase} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
