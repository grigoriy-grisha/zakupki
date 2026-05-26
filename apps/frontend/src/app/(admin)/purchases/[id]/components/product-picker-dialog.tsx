'use client';

import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useAddPurchaseItems } from '../hooks';
import type { ProductPickerDialogProps } from '../../../lib/types';

type ProductItem = {
    id: number;
    name: string;
    pricePerUnit: number | string;
    minPackageAmount: number | string | null;
    minPackageUnit: string | null;
    unit: { shortName: string } | null;
};

export function ProductPickerDialog({ purchaseId, existingProductIds }: ProductPickerDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [detailProduct, setDetailProduct] = useState<number | null>(null);
    const [publishTg, setPublishTg] = useState(false);

    const { data: allProducts } = trpc.products.list.useQuery(undefined, { enabled: open });
    const addItems = useAddPurchaseItems(purchaseId);

    const availableProducts = ((allProducts ?? []) as unknown as ProductItem[]).filter((p) => !existingProductIds.has(p.id));

    function toggleProduct(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleAdd(publishToTg: boolean) {
        addItems.mutate(
            { purchaseId, productIds: Array.from(selectedIds), publishToTg },
            {
                onSuccess: () => {
                    setOpen(false);
                    setSelectedIds(new Set());
                    setDetailProduct(null);
                    setPublishTg(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDetailProduct(null); }}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить товары
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Выбрать товары из каталога</DialogTitle>
                </DialogHeader>

                {detailProduct !== null ? (
                    <ProductDetail
                        productId={detailProduct}
                        isSelected={selectedIds.has(detailProduct)}
                        publishTg={publishTg}
                        onToggle={() => toggleProduct(detailProduct)}
                        onAdd={() => { if (!selectedIds.has(detailProduct)) toggleProduct(detailProduct); handleAdd(publishTg); }}
                        onPublishChange={setPublishTg}
                        onBack={() => setDetailProduct(null)}
                    />
                ) : (
                    <>
                        <div className="max-h-[400px] space-y-2 overflow-y-auto">
                            {availableProducts.length === 0 && (
                                <p className="py-4 text-center text-sm text-muted-foreground">
                                    Все товары уже добавлены
                                </p>
                            )}
                            {availableProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
                                >
                                    <div onClick={(e) => { e.stopPropagation(); toggleProduct(product.id); }}>
                                        <Checkbox
                                            checked={selectedIds.has(product.id)}
                                            onCheckedChange={() => toggleProduct(product.id)}
                                        />
                                    </div>
                                    <div
                                        className="flex-1"
                                        onClick={() => setDetailProduct(product.id)}
                                    >
                                        <p className="text-sm font-medium">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {product.minPackageAmount != null && product.minPackageUnit
                                                ? `${Number(product.minPackageAmount)} ${product.minPackageUnit}`
                                                : '—'}
                                            {' · '}
                                            {Number(product.pricePerUnit).toLocaleString('ru-RU')} ₽/{product.unit?.shortName ?? ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <Checkbox
                                    checked={publishTg}
                                    onCheckedChange={(v) => setPublishTg(v === true)}
                                />
                                <Send className="h-4 w-4 text-muted-foreground" />
                                Опубликовать в Telegram
                            </label>
                            <Button
                                className="w-full"
                                disabled={selectedIds.size === 0 || addItems.isPending}
                                onClick={() => handleAdd(publishTg)}
                            >
                                {addItems.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Добавить {selectedIds.size > 0 && `(${selectedIds.size})`}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ProductDetail({
    productId,
    isSelected,
    publishTg,
    onToggle,
    onAdd,
    onPublishChange,
    onBack,
}: {
    productId: number;
    isSelected: boolean;
    publishTg: boolean;
    onToggle: () => void;
    onAdd: () => void;
    onPublishChange: (v: boolean) => void;
    onBack: () => void;
}) {
    const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });

    if (isLoading) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Загрузка...</div>;
    }

    if (!product) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Товар не найден</div>;
    }

    return (
        <div className="space-y-4">
            <button
                onClick={onBack}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                ← Назад к списку
            </button>

            <div>
                <h3 className="text-lg font-semibold">{product.name}</h3>
                {product.sku && <p className="text-sm text-muted-foreground">Артикул: {product.sku}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Цена</p>
                    <p className="font-medium">{Number(product.pricePerUnit).toLocaleString('ru-RU')} ₽/{product.unit?.shortName ?? ''}</p>
                </div>
                {product.minPackageAmount != null && (
                    <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">Фасовка</p>
                        <p className="font-medium">{Number(product.minPackageAmount)} {product.minPackageUnit ?? ''}</p>
                    </div>
                )}
            </div>

            {product.description && (
                <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm text-muted-foreground">Описание</p>
                    <div
                        className="prose prose-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                </div>
            )}

            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                    <Button
                        className="flex-1"
                        onClick={isSelected ? onAdd : () => { onToggle(); }}
                        variant={isSelected ? 'outline' : 'default'}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {isSelected ? 'Добавить в закупку' : 'Выбрать'}
                    </Button>
                    {isSelected && (
                        <Button onClick={onAdd}>
                            Подтвердить
                        </Button>
                    )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                        checked={publishTg}
                        onCheckedChange={(v) => onPublishChange(v === true)}
                    />
                    <Send className="h-4 w-4 text-muted-foreground" />
                    Опубликовать в Telegram
                </label>
            </div>
        </div>
    );
}
