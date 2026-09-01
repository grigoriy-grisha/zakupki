'use client';

import { Boxes,CheckCircle2, Loader2, Package, Rocket, Trash2, Users } from 'lucide-react';
import { use, useMemo, useState } from 'react';

import { useStatusChangeConfirm } from '@/app/(admin)/lib/use-status-change-confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { STATUS_LABELS } from '../../lib/constants';
import { ExportPurchaseButtons } from './components/export-purchase-buttons';
import { ItemsTab } from './components/items/items-tab';
import { PackingTab } from './components/packing/packing-tab';
import { AdminParticipantsList } from './components/participants/admin-participants-list';
import { PurchaseStats } from './components/purchase-stats';
import { PurchaseStepCard } from './components/purchase-step-card';
import { PurchaseStepper } from './components/purchase-stepper';
import { SupplementDialog } from './components/supplements/supplement-dialog';
import { usePurchaseActions, usePurchaseDetail } from './hooks';
import { useParticipantsData } from './hooks/use-participants-data';

type PurchaseStatus = 'DRAFT' | 'ACTIVE' | 'DONE' | 'CLOSED' | 'ARRIVED';
type TabId = 'items' | 'packing' | 'participants';

type FulfillmentStatus =
    | 'COLLECTION'
    | 'REORDER'
    | 'PAYMENT'
    | 'SUPPLIER_ASSEMBLY'
    | 'PREPARING_SHIPMENT_RF'
    | 'IN_TRANSIT_RF'
    | 'IN_TRANSIT_TO_ORGANIZER'
    | 'PACKAGING'
    | 'READY_FOR_PICKUP';

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);

    const [activateOpen, setActivateOpen] = useState(false);
    const [remainderOpen, setRemainderOpen] = useState(false);
    const [selectedForPublish, setSelectedForPublish] = useState(0);
    const [tab, setTab] = useState<TabId>('items');

    const { detail: purchase, isLoading } = usePurchaseDetail(id);
    const actions = usePurchaseActions(id);
    const participantsData = useParticipantsData(id);

    const items = useMemo(() => purchase?.items ?? [], [purchase]);

    const purchaseTag = (purchase as { tag?: string } | undefined)?.tag ?? '';

    const deleteDraftConfirm = useStatusChangeConfirm<PurchaseStatus>({
        onConfirm: () => actions.deleteDraft.mutate({ id } as never),   
        buildMessage: () => ({
            title: 'Удалить черновик?',
            description: `Черновик «${purchaseTag}» будет удалён безвозвратно. Это действие нельзя отменить.`,
            confirmLabel: 'Удалить',
            variant: 'destructive',
        }),
    });

    const completeConfirm = useStatusChangeConfirm<PurchaseStatus>({
        onConfirm: () => actions.complete.mutate({ id } as never),
        buildMessage: () => ({
            title: 'Завершить закупку?',
            description: (
                <>
                    Закупка <strong>{purchaseTag}</strong> будет помечена как завершённая. Участники больше не
                    смогут делать заказы.
                </>
            ),
            confirmLabel: 'Завершить закупку',
            variant: 'destructive',
        }),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64 rounded-md" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="rounded-2xl bg-bg-soft p-10 text-center text-14-regular text-fg-secondary">
                Закупка не найдена
            </div>
        );
    }

    const isDraft = purchase.status === 'DRAFT';
    const canComplete = purchase.status === 'ACTIVE';
    const fulfillmentStatus = (purchase as { fulfillmentStatus?: string }).fulfillmentStatus as
        | FulfillmentStatus
        | undefined;

    return (
        <div className="space-y-5">
            <PageHeader
                title={purchase.tag}
                badge={
                    <Badge type="subtle" size="default" variant="neutral">
                        {STATUS_LABELS[purchase.status] ?? purchase.status}
                    </Badge>
                }
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <ExportPurchaseButtons purchaseId={id} />
                        {isDraft && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteDraftConfirm.requestStatusChange({ target: 'DRAFT' })}
                                >
                                    <Trash2 className="size-4" />
                                    <span className="hidden sm:inline">Удалить</span>
                                </Button>
                                <Button variant="brand" size="sm" onClick={() => setActivateOpen(true)}>
                                    <Rocket className="size-4" />
                                    <span className="hidden sm:inline">Активировать</span>
                                </Button>
                            </>
                        )}
                        {canComplete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => completeConfirm.requestStatusChange({ target: 'DONE' })}
                            >
                                <CheckCircle2 className="size-4" />
                                <span className="hidden sm:inline">Завершить</span>
                            </Button>
                        )}
                    </div>
                }
            />

            <PurchaseStepper currentStatus={fulfillmentStatus ?? null} />

            {!isDraft && fulfillmentStatus && (
                <PurchaseStepCard
                    purchaseId={id}
                    status={fulfillmentStatus}
                    purchaseTag={purchase.tag}
                    selectedForPublishCount={selectedForPublish}
                    canClose={canComplete}
                    onClearPublishSelection={() => setSelectedForPublish(0)}
                    onOpenRemainderDialog={() => setRemainderOpen(true)}
                />
            )}

            {isDraft && (
                <div className="rounded-2xl bg-bg-soft p-4">
                    <SectionHeader
                        title="Этап закупки"
                        description="Черновик не имеет этапа. Активируйте закупку, чтобы участники могли делать заказы."
                    />
                </div>
            )}

            <PurchaseStats
                itemsCount={items.length}
                totalOrders={items.reduce((sum, it) => sum + (it.orderLines?.length ?? 0), 0)}
                totalDue={participantsData.totalDue}
                totalPaid={participantsData.totalPaid}
                totalPending={participantsData.totalPending}
                participantsCount={participantsData.userIds.length}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-4">
                <TabsList>
                    <TabsTrigger value="items">
                        <Package className="size-3.5" />
                        Товары
                        <span className="ml-1 text-12-medium tabular-nums opacity-80">{items.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="packing">
                        <Boxes className="size-3.5" />
                        Этикетки
                        <span className="ml-1 text-12-medium tabular-nums opacity-80">{items.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="participants">
                        <Users className="size-3.5" />
                        Участники
                        <span className="ml-1 text-12-medium tabular-nums opacity-80">
                            {participantsData.userIds.length}
                        </span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-3 space-y-3">
                    <SectionHeader
                        title="Товары в закупке"
                        description={`${items.length} ${items.length === 1 ? 'товар' : 'товаров'} · нажмите на строку, чтобы редактировать`}
                    />
                    <ItemsTab purchaseId={id} onSelectionChange={setSelectedForPublish} />
                </TabsContent>

                <TabsContent value="packing" className="mt-3 space-y-3">
                    <PackingTab purchaseId={id} items={items} />
                </TabsContent>

                <TabsContent value="participants" className="mt-3 space-y-3">
                    <AdminParticipantsList purchaseId={id} />
                </TabsContent>
            </Tabs>

            {deleteDraftConfirm.dialog}
            {completeConfirm.dialog}

            <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Активировать закупку?</DialogTitle>
                    </DialogHeader>
                    <p className="text-14-regular text-fg-secondary">
                        Закупка станет доступна участникам для заказов. Публикация в Telegram выполняется
                        отдельно кнопкой «Опубликовать в TG».
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActivateOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            variant="brand"
                            disabled={actions.activate.isPending}
                            onClick={() =>
                                actions.activate.mutate(
                                    { purchaseId: id },
                                    { onSuccess: () => setActivateOpen(false) },
                                )
                            }
                        >
                            {actions.activate.isPending && <Loader2 className="size-4 animate-spin" />}
                            Активировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SupplementDialog purchaseId={id} open={remainderOpen} onOpenChange={setRemainderOpen} />
        </div>
    );
}
