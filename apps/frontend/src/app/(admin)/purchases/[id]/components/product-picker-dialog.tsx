'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Package, Plus, Search } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAddPurchaseItems } from '../hooks';
import { useUpdateProduct } from '../../../products/hooks';
import { formatProductAttributesLine, getProductPhotoId, type ProductLabelSource } from '../../../products/lib';
import { ProductSheet } from '../../../products/components';
import { PurchaseProductEditForm } from './purchase-product-edit-form';

interface ProductPickerDialogProps {
    purchaseId: number;
    purchaseTag: string;
    existingProductIds: Set<number>;
}

type PickerProduct = ProductLabelSource & { id: number };

export function ProductPickerDialog({ purchaseId, purchaseTag, existingProductIds }: ProductPickerDialogProps) {
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

    const availableProducts = useMemo(
        () => ((allProducts ?? []) as PickerProduct[]).filter((p) => !existingProductIds.has(p.id)),
        [allProducts, existingProductIds],
    );

    function handleAdd(productIds: number[]) {
        if (productIds.length === 0) return;
        addItems.mutate(
            { purchaseId, productIds },
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
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                    <span className="sm:hidden">Добавить</span>
                    <span className="hidden sm:inline">Добавить товары</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Выбрать товары из каталога</DialogTitle>
                </DialogHeader>

                {detailProduct !== null ? (
                    <ProductDetail
                        productId={detailProduct}
                        purchaseTag={purchaseTag}
                        onAdd={handleAdd}
                        onBack={() => setDetailProduct(null)}
                        isAdding={addItems.isPending}
                    />
                ) : (
                    <>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Поиск: название, номер, MIYUKI, Delica, 11/0…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                                Нажмите на товар, чтобы настроить и добавить в закупку.
                            </p>
                            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Создать товар
                            </Button>
                        </div>

                        <div className="max-h-[400px] space-y-2 overflow-y-auto">
                            {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Загрузка…</p>}
                            {!isLoading && availableProducts.length === 0 && (
                                <p className="py-4 text-center text-sm text-muted-foreground">
                                    {search.trim() ? 'Ничего не найдено' : 'Все товары уже добавлены в закупку'}
                                </p>
                            )}
                            {availableProducts.map((product) => (
                                <ProductPickerRow
                                    key={product.id}
                                    product={product}
                                    onOpenDetail={() => setDetailProduct(product.id)}
                                />
                            ))}
                        </div>
                    </>
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
        <button
            type="button"
            className="flex w-full items-start gap-3 rounded-md border p-3 text-left hover:bg-accent"
            onClick={onOpenDetail}
        >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {photoId ? (
                    <img src={`/api/photos/${photoId}`} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium leading-snug">{product.name}</p>
                {attributesLine ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">{attributesLine}</p>
                ) : (
                    <p className="text-xs text-muted-foreground">Атрибуты не указаны</p>
                )}
            </div>
        </button>
    );
}

function ProductDetail({
    productId,
    purchaseTag,
    onAdd,
    onBack,
    isAdding,
}: {
    productId: number;
    purchaseTag: string;
    onAdd: (productIds: number[]) => void;
    onBack: () => void;
    isAdding: boolean;
}) {
    const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });
    const utils = trpc.useUtils();
    const updateMutation = useUpdateProduct();

    if (isLoading) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Загрузка...</div>;
    }

    if (!product) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Товар не найден</div>;
    }

    return (
        <div className="space-y-2">
            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Назад к списку
            </button>
            <PurchaseProductEditForm
                key={productId}
                product={product}
                purchaseTag={purchaseTag}
                loadSavedDescription={false}
                initialTiers={[]}
                onSave={(data) => {
                    updateMutation.mutate(
                        {
                            id: productId,
                            description: data.description,
                            pricePerUnit: data.priceOverride ?? undefined,
                            priceTiers: data.priceTiers,
                            minPackageAmount: data.minPackageAmount ?? undefined,
                            minPackageUnit: data.minPackageUnit ?? undefined,
                            supplierPackageAmount: data.supplierPackageAmount ?? undefined,
                            supplierPackageUnit: data.supplierPackageUnit ?? undefined,
                            supplierPackagePrice: data.supplierPackagePrice ?? undefined,
                            supplierPackageTiers:
                                data.supplierPackageTiers.length > 0 ? data.supplierPackageTiers : undefined,
                        },
                        {
                            onSuccess: () => {
                                void utils.products.getById.invalidate({ id: productId });
                                void utils.products.list.invalidate();
                                toast.success('Товар обновлён');
                                onAdd([productId]);
                            },
                            onError: (err) => toast.error(err.message),
                        },
                    );
                }}
                isSaving={updateMutation.isPending || isAdding}
                submitLabel="Сохранить и добавить в закупку"
            />
        </div>
    );
}
