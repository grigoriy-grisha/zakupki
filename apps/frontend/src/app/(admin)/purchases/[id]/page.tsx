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
import { useActivate, useCompletePurchase, useDeleteDraftPurchase, useUpdateFulfillmentStatus } from './hooks';
import { ExportPurchaseButtons, ItemsTab, ParticipantsTab, SupplementTab } from './components';
import { PurchaseFulfillmentStatusSelect } from '../components/purchase-fulfillment-status-select';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const [activateOpen, setActivateOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const router = useAppRouter();

    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id });
    const activate = useActivate(id);
    const completePurchase = useCompletePurchase(id);
    const deleteDraft = useDeleteDraftPurchase();
    const updateFulfillmentStatus = useUpdateFulfillmentStatus(id);

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
    const fulfillmentStatus = (purchase as { fulfillmentStatus?: PurchaseFulfillmentStatus }).fulfillmentStatus;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{purchase.tag}</h1>
                        <Badge>{STATUS_LABELS[purchase.status] ?? purchase.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{purchase.supplier}</p>
                    <p className="text-sm text-muted-foreground">
                        Мин. сумма: {Number(purchase.minAmount).toLocaleString('ru-RU')} ₽ · До{' '}
                        {deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {!isDraft && (
                        <div className="mt-3 max-w-md space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Этап закупки</p>
                            <PurchaseFulfillmentStatusSelect
                                value={fulfillmentStatus}
                                disabled={updateFulfillmentStatus.isPending}
                                onChange={(next) => {
                                    updateFulfillmentStatus.mutate({ id, fulfillmentStatus: next });
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                    {isDraft && (
                        <>
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                                <span className="sm:hidden">Удалить</span>
                                <span className="hidden sm:inline">Удалить черновик</span>
                            </Button>
                            <Button className="w-full sm:w-auto" onClick={() => setActivateOpen(true)}>
                                <Rocket className="mr-2 h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                                <span className="sm:hidden">Активировать</span>
                                <span className="hidden sm:inline">Активировать закупку</span>
                            </Button>
                        </>
                    )}
                    {canComplete && (
                        <Button
                            variant="destructive"
                            className="w-full sm:w-auto"
                            onClick={() => setCompleteOpen(true)}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                            <span className="sm:hidden">Завершить</span>
                            <span className="hidden sm:inline">Завершить закупку</span>
                        </Button>
                    )}
                </div>
            </div>

            <ExportPurchaseButtons purchaseId={id} />

            <Tabs defaultValue="items">
                <TabsList>
                    <TabsTrigger value="items">Товары</TabsTrigger>
                    <TabsTrigger value="supplement">Доборы</TabsTrigger>
                    <TabsTrigger value="participants">Участники</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4">
                    <ItemsTab purchaseId={id} />
                </TabsContent>

                <TabsContent value="supplement" className="mt-4">
                    <SupplementTab purchaseId={id} />
                </TabsContent>

                <TabsContent value="participants" className="mt-4">
                    <ParticipantsTab purchaseId={id} />
                </TabsContent>
            </Tabs>

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

            <ConfirmDialog
                open={completeOpen}
                onOpenChange={setCompleteOpen}
                title="Вы уверены, что хотите завершить закупку?"
                description={
                    <>
                        Закупка <strong>{purchase.tag}</strong> будет переведена в статус «Завершена». Участники
                        больше не смогут оформлять и менять заказы.
                    </>
                }
                confirmLabel="Завершить закупку"
                variant="destructive"
                loading={completePurchase.isPending}
                onConfirm={() => {
                    completePurchase.mutate({ id }, { onSuccess: () => setCompleteOpen(false) });
                }}
            />

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
