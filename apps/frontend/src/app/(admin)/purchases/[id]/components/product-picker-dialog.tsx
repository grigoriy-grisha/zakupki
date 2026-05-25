'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAddPurchaseItems } from '../hooks';
import type { ProductPickerDialogProps } from '../../../lib/types';

export function ProductPickerDialog({ purchaseId, existingProductIds }: ProductPickerDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const { data: allProducts } = trpc.products.list.useQuery(undefined, { enabled: open });
    const addItems = useAddPurchaseItems(purchaseId);

    const availableProducts = allProducts?.filter((p) => !existingProductIds.has(p.id)) ?? [];

    function toggleProduct(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleAdd() {
        addItems.mutate(
            { purchaseId, productIds: Array.from(selectedIds) },
            {
                onSuccess: () => {
                    setOpen(false);
                    setSelectedIds(new Set());
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить товары
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Выбрать товары из каталога</DialogTitle>
                </DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {availableProducts.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Все товары уже добавлены
                        </p>
                    )}
                    {availableProducts.map((product) => (
                        <label
                            key={product.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
                        >
                            <Checkbox
                                checked={selectedIds.has(product.id)}
                                onCheckedChange={() => toggleProduct(product.id)}
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {product.brand ?? 'Без бренда'} · {Number(product.pricePerUnit).toLocaleString('ru-RU')} ₽/{product.unit?.shortName ?? ''}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>
                <Button
                    className="w-full"
                    disabled={selectedIds.size === 0 || addItems.isPending}
                    onClick={handleAdd}
                >
                    Добавить {selectedIds.size > 0 && `(${selectedIds.size})`}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
