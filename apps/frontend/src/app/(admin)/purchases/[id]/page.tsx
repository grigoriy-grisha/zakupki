'use client';

import { use, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Rocket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS } from '../../lib/constants';
import { useActivateAndPublish } from './hooks';
import { ItemsTab, ParticipantsTab, SupplementDialog } from './components';

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const [supplementOpen, setSupplementOpen] = useState(false);
    const [activateOpen, setActivateOpen] = useState(false);

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const activateAndPublish = useActivateAndPublish(id);

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
    const isDraft = purchase.status === 'DRAFT';
    const publishCount = purchase.items.filter((i: any) => i.shouldPublish && !i.tgMessageId).length;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight">{purchase.tag}</h1>
                        <Badge>{STATUS_LABELS[purchase.status] ?? purchase.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{purchase.supplier}</p>
                    <p className="text-sm text-muted-foreground">
                        Мин. сумма: {Number(purchase.minAmount).toLocaleString('ru-RU')} ₽ · До{' '}
                        {deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {isDraft && (
                        <Button size="lg" onClick={() => setActivateOpen(true)}>
                            <Rocket className="mr-2 h-5 w-5" />
                            Активировать закупку
                        </Button>
                    )}
                    {purchase.status === 'SUPPLEMENT' && (
                        <Button variant="outline" size="sm" onClick={() => setSupplementOpen(true)}>
                            Остатки
                        </Button>
                    )}
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

            <SupplementDialog purchaseId={id} open={supplementOpen} onOpenChange={setSupplementOpen} />

            <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Активировать закупку?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {publishCount > 0
                            ? `${publishCount} товаров будет опубликовано в Telegram.`
                            : 'Ни один товар не отмечен для публикации в Telegram.'}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActivateOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            disabled={activateAndPublish.isPending}
                            onClick={() => {
                                activateAndPublish.mutate(
                                    { purchaseId: id },
                                    { onSuccess: () => setActivateOpen(false) },
                                );
                            }}
                        >
                            {activateAndPublish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Активировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
