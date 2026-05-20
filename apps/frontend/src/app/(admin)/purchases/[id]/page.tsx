'use client';

import { use, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS } from '../lib/constants';
import { useUpdatePurchaseStatus } from './hooks';
import { ItemsTab, ParticipantsTab, SupplementDialog } from './components';

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const [supplementOpen, setSupplementOpen] = useState(false);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const updateStatus = useUpdatePurchaseStatus(id);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!purchase) {
        return <p className="text-muted-foreground">Закупка не найдена</p>;
    }

    const deadline = new Date(purchase.deadline);

    function handleStatusChange(status: string) {
        updateStatus.mutate({ id, status: status as never });
        if (status === 'SUPPLEMENT') {
            setSupplementOpen(true);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight">{purchase.tag}</h1>
                        <Badge>{STATUS_LABELS[purchase.status] ?? purchase.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{purchase.title}</p>
                    <p className="text-sm text-muted-foreground">
                        Мин. сумма: {Number(purchase.minAmount).toLocaleString('ru-RU')} ₽ · До{' '}
                        {deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {purchase.status === 'SUPPLEMENT' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSupplementOpen(true)}
                        >
                            Остатки
                        </Button>
                    )}
                    <Select
                        value={purchase.status}
                        onValueChange={handleStatusChange}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="items">
                <TabsList>
                    <TabsTrigger value="items">Товары</TabsTrigger>
                    <TabsTrigger value="participants">Участники</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4">
                    <ItemsTab purchaseId={id} onEditSupplement={() => setSupplementOpen(true)} />
                </TabsContent>

                <TabsContent value="participants" className="mt-4">
                    <ParticipantsTab purchaseId={id} />
                </TabsContent>
            </Tabs>

            <SupplementDialog
                purchaseId={id}
                open={supplementOpen}
                onOpenChange={setSupplementOpen}
            />
        </div>
    );
}
