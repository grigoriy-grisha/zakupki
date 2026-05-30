'use client';

import { use, useState } from 'react';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { trpc } from '@/lib/client/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CheckCircle2, Loader2, Rocket, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS } from '../../lib/constants';
import { useActivate, useCompletePurchase, useDeleteDraftPurchase } from './hooks';
import { ExportPurchaseButtons, ItemsTab, ParticipantsTab, SupplementDialog } from './components';

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const [supplementOpen, setSupplementOpen] = useState(false);
    const [activateOpen, setActivateOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const router = useAppRouter();

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const activate = useActivate(id);
    const completePurchase = useCompletePurchase(id);
    const deleteDraft = useDeleteDraftPurchase();

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
    const canComplete = purchase.status === 'ACTIVE' || purchase.status === 'SUPPLEMENT';

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
                        <>
                            <Button variant="outline" size="lg" onClick={() => setDeleteOpen(true)}>
                                <Trash2 className="mr-2 h-5 w-5" />
                                Удалить черновик
                            </Button>
                            <Button size="lg" onClick={() => setActivateOpen(true)}>
                                <Rocket className="mr-2 h-5 w-5" />
                                Активировать закупку
                            </Button>
                        </>
                    )}
                    {purchase.status === 'SUPPLEMENT' && (
                        <Button variant="outline" size="sm" onClick={() => setSupplementOpen(true)}>
                            Остатки
                        </Button>
                    )}
                    {canComplete && (
                        <Button variant="outline" size="lg" onClick={() => setCompleteOpen(true)}>
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            Завершить закупку
                        </Button>
                    )}
                </div>
            </div>

            <ExportPurchaseButtons purchaseId={id} />

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

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Удалить черновик?"
                description={
                    <>
                        Закупка <strong>{purchase.tag}</strong> и все добавленные в неё товары будут удалены без
                        возможности восстановления.
                    </>
                }
                loading={deleteDraft.isPending}
                onConfirm={() => {
                    deleteDraft.mutate(
                        { id },
                        {
                            onSuccess: () => {
                                setDeleteOpen(false);
                                router.push('/purchases');
                            },
                        },
                    );
                }}
            />

            <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Завершить закупку?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Участники больше не смогут оформлять и менять заказы. Закупка появится во вкладке
                        «Завершённые».
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            disabled={completePurchase.isPending}
                            onClick={() => {
                                completePurchase.mutate(
                                    { id },
                                    { onSuccess: () => setCompleteOpen(false) },
                                );
                            }}
                        >
                            {completePurchase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Завершить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Активировать закупку?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Закупка станет доступна участникам для заказов. Публикация в Telegram выполняется отдельно
                        кнопкой «Опубликовать в TG».
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActivateOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            disabled={activate.isPending}
                            onClick={() => {
                                activate.mutate({ purchaseId: id }, { onSuccess: () => setActivateOpen(false) });
                            }}
                        >
                            {activate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Активировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
