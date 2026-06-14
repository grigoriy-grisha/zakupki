'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SupplementDialogProps {
    purchaseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SupplementDialog({ purchaseId, open, onOpenChange }: SupplementDialogProps) {
    const utils = trpc.useUtils();
    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId }, { enabled: open });

    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [supplementSteps, setSupplementSteps] = useState<Record<number, string>>({});

    const supplementItems = (purchase as { items?: any[] })?.items ?? [];

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
    }, [purchase, open]);

    const mutation = trpc.purchases.setAvailableQuantities.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Остатки сохранены');
            onOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
    });

    function handleSubmit() {
        if (!purchase) return;
        const items = supplementItems.map((item: any) => {
            const val = quantities[item.id];
            const stepVal = supplementSteps[item.id];
            return {
                purchaseItemId: item.id,
                targetRemainder: val === '' ? null : Number(val),
                supplementStep: stepVal === '' ? null : Number(stepVal),
            };
        });
        mutation.mutate({ purchaseId, items });
    }

    if (!purchase) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Остатки для добора</DialogTitle>
                    <DialogDescription>
                        Укажите target-остаток для добора по каждому товару — сколько грамм/штук суммарно смогут
                        заказать участники на этом этапе. Оставьте пустым, если без ограничения. Остаток пересчитывается
                        автоматически по мере заказов.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {supplementItems.map((item: any) => {
                        const orderedTotal = item.orderLines.reduce(
                            (sum: number, ol: any) => sum + Number(ol.quantity),
                            0,
                        );
                        const shortName = item.product.unit?.shortName ?? '';
                        const val = quantities[item.id] ?? '';

                        return (
                            <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Заказано: {orderedTotal} {shortName}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-28 shrink-0">
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">
                                            Остаток
                                        </label>
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
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="w-28 shrink-0">
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">
                                            Фасовка добора
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            placeholder="По умолч."
                                            value={supplementSteps[item.id] ?? ''}
                                            onChange={(e) =>
                                                setSupplementSteps((prev) => ({
                                                    ...prev,
                                                    [item.id]: e.target.value,
                                                }))
                                            }
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0 w-8">{shortName}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
