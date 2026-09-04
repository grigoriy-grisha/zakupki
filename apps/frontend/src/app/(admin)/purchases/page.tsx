'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/client/trpc';

import { PurchaseCard, PurchaseForm } from './components';

export default function PurchasesPage() {
    const [tab, setTab] = useState('ACTIVE');
    const [newOpen, setNewOpen] = useState(false);

    const isDeletedTab = tab === 'deleted';
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery(
        tab === 'all' ? undefined : { status: tab },
        { enabled: !isDeletedTab },
    );
    const { data: deletedPurchases, isLoading: deletedLoading } = trpc.purchases.listDeleted.useQuery(undefined, {
        enabled: isDeletedTab,
    });
    const items = isDeletedTab ? deletedPurchases : purchases;
    const loading = isDeletedTab ? deletedLoading : isLoading;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Закупки"
                actions={
                    <Button size="sm" onClick={() => setNewOpen(true)}>
                        <Plus className="size-4" />
                        Новая закупка
                    </Button>
                }
            />

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="all">Все</TabsTrigger>
                    <TabsTrigger value="DRAFT">Черновики</TabsTrigger>
                    <TabsTrigger value="ACTIVE">Активные</TabsTrigger>
                    <TabsTrigger value="DONE">Завершённые</TabsTrigger>
                    <TabsTrigger value="deleted">Удалённые</TabsTrigger>
                </TabsList>

                <TabsContent value={tab} className="mt-4">
                    {loading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-40" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {items?.length === 0 && (
                                <p className="col-span-full py-12 text-center text-14-regular text-fg-secondary">Нет закупок</p>
                            )}
                            {items?.map((purchase) => (
                                <PurchaseCard key={purchase.id} purchase={purchase} deleted />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Новая закупка</DialogTitle>
                        <DialogDescription>Заполните данные для создания новой закупки</DialogDescription>
                    </DialogHeader>
                    <PurchaseForm />
                </DialogContent>
            </Dialog>
        </div>
    );
}
