'use client';

import { useState } from 'react';
import { ArrowRightIcon, SendIcon, Settings2Icon, ShieldCheckIcon } from 'lucide-react';
import {
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_FULFILLMENT_STATUSES,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';

import { Button } from '@/components/ui/button';
import { usePurchaseActions } from '../hooks';
import { PublishToTgDialog } from './publish-to-tg-dialog';
import { STEP_DESCRIPTIONS } from '../lib/step-descriptions';
import { useStatusChangeConfirm } from '@/app/(admin)/lib/use-status-change-confirm';

interface PurchaseStepCardProps {
    purchaseId: number;
    status: PurchaseFulfillmentStatus;
    /** Кол-во отмеченных товаров для bulk-publish. */
    selectedForPublishCount: number;
    /** Сбросить выделение после публикации. */
    onClearPublishSelection?: () => void;
    /** Открыть диалог остатков для добора. */
    onOpenRemainderDialog?: () => void;
    /** Тег закупки (для текста подтверждения). */
    purchaseTag?: string;
    canClose?: boolean;
}

const NEXT_STATUS_LABEL: Partial<Record<PurchaseFulfillmentStatus, string>> = {
    COLLECTION: 'Перейти к добору',
    REORDER: 'Завершить добор',
    PAYMENT: 'Завершить приём оплат',
    SUPPLIER_ASSEMBLY: 'Заказ собран, отправляем',
    PREPARING_SHIPMENT_RF: 'Отправлено со склада',
    IN_TRANSIT_RF: 'Получено в РФ',
    IN_TRANSIT_TO_ORGANIZER: 'Принято организатором',
    PACKAGING: 'Расфасовано',
    READY_FOR_PICKUP: 'Готово к выдаче',
};

function nextStatus(s: PurchaseFulfillmentStatus): PurchaseFulfillmentStatus | null {
    const idx = PURCHASE_FULFILLMENT_STATUSES.indexOf(s);
    if (idx < 0 || idx === PURCHASE_FULFILLMENT_STATUSES.length - 1) return null;
    return PURCHASE_FULFILLMENT_STATUSES[idx + 1];
}

/**
 * Карточка-пояснение текущего этапа закупки. Содержит иконку, описание, и кнопки действий,
 * зависящие от этапа (publish-tg / remainder / advance / close).
 */
export function PurchaseStepCard({
    purchaseId,
    status,
    selectedForPublishCount,
    onClearPublishSelection,
    onOpenRemainderDialog,
    purchaseTag,
    canClose,
}: PurchaseStepCardProps) {
    const [publishOpen, setPublishOpen] = useState(false);
    const actions = usePurchaseActions(purchaseId);
    const desc = STEP_DESCRIPTIONS[status];
    const Icon = desc.icon;
    const next = nextStatus(status);
    const nextLabel = next ? (NEXT_STATUS_LABEL[status] ?? `→ ${PURCHASE_FULFILLMENT_LABELS[next]}`) : null;

    // Shared-хук: подтверждение перед переключением этапа.
    const advanceConfirm = useStatusChangeConfirm<PurchaseFulfillmentStatus>({
        onConfirm: () => {
            if (next) actions.updateFulfillmentStatus.mutate({ id: purchaseId, fulfillmentStatus: next });
        },
        buildMessage: (req) => ({
            title: `Перевести закупку в этап «${PURCHASE_FULFILLMENT_LABELS[req.target]}»?`,
            description: (
                <>
                    Закупка {purchaseTag && <strong>{purchaseTag}</strong>} перейдёт из{' '}
                    <em>{PURCHASE_FULFILLMENT_LABELS[status]}</em> в{' '}
                    <strong>{PURCHASE_FULFILLMENT_LABELS[req.target]}</strong>. Участники увидят изменения
                    сразу.
                </>
            ),
            confirmLabel: nextLabel ?? 'Перевести',
            variant: 'default',
        }),
    });

    function handleAdvance() {
        if (!next) return;
        advanceConfirm.requestStatusChange({ target: next });
    }

    const closeConfirm = useStatusChangeConfirm<'DONE'>({
        onConfirm: () => actions.complete.mutate({ id: purchaseId }),
        buildMessage: () => ({
            title: 'Завершить закупку?',
            description: (
                <>
                    Закупка {purchaseTag && <strong>{purchaseTag}</strong>} получит статус «Завершена».
                    Участники получат уведомление, отменить будет нельзя.
                </>
            ),
            confirmLabel: 'Завершить',
            variant: 'destructive',
        }),
    });

    function handlePublish() {
        actions.publishAll.mutate(
            { purchaseId, purchaseItemIds: [] },
            {
                onSuccess: () => {
                    setPublishOpen(false);
                    onClearPublishSelection?.();
                },
            },
        );
    }

    return (
        <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-18-semibold text-fg-primary">{desc.title}</h2>
                            {desc.hint && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-12-medium text-primary">
                                    {desc.hint}
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-14-regular text-fg-secondary">{desc.description}</p>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {desc.actions.includes('remainder') && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={onOpenRemainderDialog}
                        >
                            <Settings2Icon className="size-3.5" />
                            Остатки для добора
                        </Button>
                    )}
                    {desc.actions.includes('advance') && next && (
                        <Button
                            variant="brand"
                            size="sm"
                            className="rounded-full"
                            onClick={handleAdvance}
                            disabled={actions.updateFulfillmentStatus.isPending}
                        >
                            {nextLabel}
                            <ArrowRightIcon className="size-3.5" />
                        </Button>
                    )}
                    {desc.actions.includes('close') && canClose && (
                        <Button
                            variant="brand"
                            size="sm"
                            className="rounded-full"
                            onClick={() => closeConfirm.requestStatusChange({ target: 'DONE' })}
                            disabled={actions.complete.isPending}
                        >
                            <ShieldCheckIcon className="size-3.5" />
                            Закрыть закупку
                        </Button>
                    )}
                </div>
            </div>

            <PublishToTgDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                publishCount={selectedForPublishCount}
                isPending={actions.publishAll.isPending}
                onPublish={handlePublish}
            />
            {advanceConfirm.dialog}
            {closeConfirm.dialog}
        </div>
    );
}
