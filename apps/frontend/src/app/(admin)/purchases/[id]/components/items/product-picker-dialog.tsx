'use client';

import { useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';

import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

import { useAddPurchaseItems } from '../../hooks';
import { formatProductAttributesLine, getProductPhotoId, type ProductLabelSource } from '../../../../products/lib';
import { ProductSheet } from '../../../../products/components';
import type { PurchaseCurrencyRateRef } from '../../lib/types';
import { PurchaseProductEditForm, type PurchaseProductSaveData } from './purchase-product-edit-form';
import { cn } from '@/lib/utils';

interface ProductPickerDialogProps {
    purchaseId: number;
    purchaseTag: string;
    /** Курсы валют закупки — для шаблонных меток {{цены}}, {{фасовка поставщика}}. */
    currencyRates: PurchaseCurrencyRateRef[];
}

type PickerProduct = ProductLabelSource & {
    id: number;
    /** Плоский код единицы из Product.unitCode. */
    unitCode: string;
};

export function ProductPickerDialog({ purchaseId, purchaseTag, currencyRates }: ProductPickerDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [detailProduct, setDetailProduct] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const utils = trpc.useUtils();

    const { data: allProducts, isLoading } = trpc.products.list.useQuery(
        { search: search.trim() || undefined },
        { enabled: open },
    );
    const addItems = useAddPurchaseItems(purchaseId);

    // Без фильтра: один и тот же товар можно добавить в закупку несколько раз
    // (для разных поставщиков / разных цен).
    const availableProducts = (allProducts ?? []) as PickerProduct[];

    function handleAdd(items: { productId: number; data: PurchaseProductSaveData }[]) {
        if (items.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- глубокий zod-тип addItems
        (addItems as any).mutate(
            {
                purchaseId,
                items: items.map((i) => ({
                    productId: i.productId,
                    ...i.data,
                })),
            },
            {
                onSuccess: () => {
                    setOpen(false);
                    setDetailProduct(null);
                },
            },
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) {
                    setDetailProduct(null);
                    setSearch('');
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="brand" size="sm" className="rounded-full">
                    <Plus className="size-3.5" />
                    <span className="sm:hidden">Добавить</span>
                    <span className="hidden sm:inline">Добавить товар</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Выбрать товар из каталога</DialogTitle>
                </DialogHeader>

                {detailProduct !== null ? (
                    <ProductDetail
                        productId={detailProduct}
                        purchaseTag={purchaseTag}
                        currencyRates={currencyRates}
                        onAdd={handleAdd}
                        onBack={() => setDetailProduct(null)}
                        isAdding={addItems.isPending}
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                            <Input
                                placeholder="Поиск: название, бренд, артикул…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 rounded-full pl-9 text-13-regular"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <p className="text-12-regular text-fg-tertiary">
                                Нажмите на товар — базовые данные подставятся автоматически
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus className="size-3.5" />
                                Создать товар
                            </Button>
                        </div>

                        <div className="max-h-[400px] space-y-2 overflow-y-auto">
                            {isLoading && (
                                <p className="py-4 text-center text-13-regular text-fg-tertiary">Загрузка…</p>
                            )}
                            {!isLoading && availableProducts.length === 0 && (
                                <div className="rounded-2xl border border-border bg-bg-card py-8 text-center">
                                    <p className="text-13-regular text-fg-tertiary">
                                        {search.trim() ? 'Ничего не найдено' : 'В каталоге пока нет товаров'}
                                    </p>
                                </div>
                            )}
                            {availableProducts.map((product) => (
                                <ProductPickerRow
                                    key={product.id}
                                    product={product}
                                    onOpenDetail={() => setDetailProduct(product.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>

            <ProductSheet
                open={createOpen}
                onOpenChange={(v) => {
                    setCreateOpen(v);
                    if (!v) void utils.products.list.invalidate();
                }}
                editId={null}
            />
        </Dialog>
    );
}

function ProductPickerRow({ product, onOpenDetail }: { product: PickerProduct; onOpenDetail: () => void }) {
    const photoId = getProductPhotoId(product);
    const attributesLine = formatProductAttributesLine(product);

    return (
        <Button
            variant="ghost"
            size="default"
            onClick={onOpenDetail}
            className={cn(
                'h-auto w-full justify-start gap-3 rounded-2xl border border-border bg-bg-card p-3 text-left',
                'hover:border-border-strong hover:bg-bg-soft',
            )}
        >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {photoId ? (
                    <img src={`/api/photos/${photoId}`} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-fg-tertiary/40" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-14-semibold text-fg-primary">{product.name}</p>
                {attributesLine && <p className="truncate text-12-regular text-fg-tertiary">{attributesLine}</p>}
            </div>
        </Button>
    );
}

function ProductDetail({
    productId,
    purchaseTag,
    currencyRates,
    onAdd,
    onBack,
    isAdding,
}: {
    productId: number;
    purchaseTag: string;
    currencyRates: PurchaseCurrencyRateRef[];
    onAdd: (items: { productId: number; data: PurchaseProductSaveData }[]) => void;
    onBack: () => void;
    isAdding: boolean;
}) {
    const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="self-start rounded-full text-fg-secondary"
                >
                    ← Назад к списку
                </Button>
                <div className="rounded-2xl border border-border bg-bg-card p-6 text-center text-13-regular text-fg-tertiary">
                    Загрузка…
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="self-start rounded-full text-fg-secondary"
                >
                    ← Назад к списку
                </Button>
                <div className="rounded-2xl border border-border bg-bg-card p-6 text-center text-13-regular text-fg-tertiary">
                    Товар не найден
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="self-start rounded-full text-fg-secondary"
            >
                ← Назад к списку
            </Button>
            <PurchaseProductEditForm
                key={productId}
                product={product}
                purchaseTag={purchaseTag}
                currencyRates={currencyRates}
                loadSavedDescription={false}
                onCancel={onBack}
                onSave={(data) => {
                    onAdd([{ productId, data }]);
                }}
                isSaving={isAdding}
                submitLabel="Добавить в закупку"
            />
        </div>
    );
}
