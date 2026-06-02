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

    const supplementItems = (purchase as { items?: any[] })?.items ?? [];

    useEffect(() => {
        if (purchase && open) {
            const map: Record<number, string> = {};
            for (const item of supplementItems) {
                map[item.id] =
                    item.availableQty !== null && item.availableQty !== undefined
                        ? String(Number(item.availableQty))
                        : '';
            }
            setQuantities(map);
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
            return {
                purchaseItemId: item.id,
                availableQty: val === '' ? null : Number(val),
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
                        Укажите свободный остаток по каждому товару. Оставьте пустым если без ограничения.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {supplementItems.map((item: any) => {
                        const orderedTotal = item.orderLines.reduce((sum: number, ol: any) => sum + Number(ol.quantity), 0);
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
                                <div className="w-32 shrink-0">
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
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{shortName}</span>
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
