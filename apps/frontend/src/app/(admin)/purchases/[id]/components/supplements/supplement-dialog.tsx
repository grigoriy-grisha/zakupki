'use client';

import { getUnitByCode } from '@zakupki/types';
import { Loader2 } from 'lucide-react';
import { useEffect,useState } from 'react';

import { useStatusChangeConfirm } from '@/app/(admin)/lib/use-status-change-confirm';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { usePurchaseActions } from '../../hooks/use-purchase-actions';
import { usePurchaseDetail } from '../../hooks/use-purchase-detail';

interface SupplementDialogProps {
    purchaseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SupplementDialog({ purchaseId, open, onOpenChange }: SupplementDialogProps) {
    const { detail: purchase } = usePurchaseDetail(purchaseId, { enabled: open });
    const { setAvailableQuantities: mutation } = usePurchaseActions(purchaseId);

    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [supplementSteps, setSupplementSteps] = useState<Record<number, string>>({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supplementItems = ((purchase as { items?: any[] })?.items ?? []) as any[];

    useEffect(() => {
        if (purchase && open) {
            const qtyMap: Record<number, string> = {};
            const stepMap: Record<number, string> = {};
            for (const item of supplementItems) {
                qtyMap[item.id] =
                    item.targetRemainder !== null && item.targetRemainder !== undefined
                        ? String(Number(item.targetRemainder))
                        : '';
                stepMap[item.id] = item.supplementStep != null ? String(Number(item.supplementStep)) : '';
            }
            setQuantities(qtyMap);
            setSupplementSteps(stepMap);
        }
    }, [purchase, open, supplementItems]);

    function handleSubmit() {
        if (!purchase) return;
        const items = supplementItems.map((item) => ({
            purchaseItemId: item.id,
            targetRemainder:
                quantities[item.id] === '' || quantities[item.id] == null
                    ? null
                    : Number(quantities[item.id]),
            supplementStep:
                supplementSteps[item.id] === '' || supplementSteps[item.id] == null
                    ? null
                    : Number(supplementSteps[item.id]),
        }));
        mutation.mutate(
            { purchaseId, items },
            { onSuccess: () => onOpenChange(false) },
        );
    }

    const { dialog: confirmDialog, requestStatusChange } = useStatusChangeConfirm<'save-supplement'>({
        onConfirm: () => handleSubmit(),
        buildMessage: () => ({
            title: 'Сохранить остатки?',
            description: `Будет обновлено ${supplementItems.length} ${
                supplementItems.length === 1 ? 'товар' : 'товаров'
            }. Участники увидят новые лимиты сразу после сохранения.`,
            confirmLabel: 'Сохранить',
            variant: 'default',
        }),
    });

    if (!purchase) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Остатки для добора</DialogTitle>
                        <DialogDescription>
                            Укажите target-остаток для добора по каждому товару — сколько грамм/штук суммарно
                            смогут заказать участники на этом этапе. Оставьте пустым, если без ограничения.
                            Остаток пересчитывается автоматически по мере заказов.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-1">
                        {supplementItems.map((item) => {
                            const orderedTotal = item.orderLines.reduce(
                                (sum: number, ol: { quantity: unknown }) => sum + Number(ol.quantity),
                                0,
                            );
                            const shortName = getUnitByCode(item.unitCode ?? item.product.unitCode)?.shortName ?? '';
                            const val = quantities[item.id] ?? '';
                            const stepVal = supplementSteps[item.id] ?? '';
                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-2xl border border-border bg-bg-base p-3"
                                >
                                    <ProductPhotoPreview
                                        photoId={item.product.photos?.[0]?.id}
                                        photoIds={item.product.photos?.map((p: { id: number }) => p.id)}
                                        alt={item.product.name}
                                        thumbClassName="h-10 w-10 rounded-lg"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-14-semibold text-fg-primary">
                                            {item.product.name}
                                        </p>
                                        <p className="truncate text-12-regular text-fg-tertiary">
                                            Заказано: {orderedTotal} {shortName}
                                        </p>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="w-[110px] shrink-0">
                                            <Label className="mb-1 block text-12-regular text-fg-tertiary">
                                                Остаток
                                            </Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="Без лимита"
                                                value={val}
                                                onChange={(e) =>
                                                    setQuantities((prev) => ({
                                                        ...prev,
                                                        [item.id]: e.target.value,
                                                    }))
                                                }
                                                className={cn('h-9 text-13-medium tabular-nums')}
                                            />
                                        </div>
                                        <div className="w-[110px] shrink-0">
                                            <Label className="mb-1 block text-12-regular text-fg-tertiary">
                                                Шаг добора
                                            </Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="По умолч."
                                                value={stepVal}
                                                onChange={(e) =>
                                                    setSupplementSteps((prev) => ({
                                                        ...prev,
                                                        [item.id]: e.target.value,
                                                    }))
                                                }
                                                className="h-9 text-13-medium tabular-nums"
                                            />
                                        </div>
                                        <span className="w-8 shrink-0 pb-2 text-center text-12-regular text-fg-tertiary">
                                            {shortName}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => onOpenChange(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="brand"
                            className="rounded-full"
                            onClick={() => requestStatusChange({ target: 'save-supplement' })}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {confirmDialog}
        </>
    );
}
