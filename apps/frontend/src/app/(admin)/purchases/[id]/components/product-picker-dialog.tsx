'use client';

import { useMemo, useState } from 'react';
import { Loader2, Package, Plus, Search } from 'lucide-react';

import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { useAddPurchaseItems } from '../hooks';
import { useUpdateProduct } from '../../../products/hooks';
import {
    formatProductAttributesLine,
    getProductPhotoId,
    type ProductLabelSource,
} from '../../../products/lib';
import { ProductSheet } from '../../../products/components';
import { PurchaseProductEditForm } from './purchase-product-edit-form';
import { cn } from '@/lib/utils';

interface ProductPickerDialogProps {
    purchaseId: number;
    purchaseTag: string;
    existingProductIds: Set<number>;
}

type PickerProduct = ProductLabelSource & { id: number };

export function ProductPickerDialog({
    purchaseId,
    purchaseTag,
    existingProductIds,
}: ProductPickerDialogProps) {
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
                                <p className="py-4 text-center text-13-regular text-fg-tertiary">
                                    Загрузка…
                                </p>
                            )}
                            {!isLoading && availableProducts.length === 0 && (
                                <div className="rounded-2xl border border-border bg-bg-card py-8 text-center">
                                    <p className="text-13-regular text-fg-tertiary">
                                        {search.trim()
                                            ? 'Ничего не найдено'
                                            : 'Все товары уже добавлены в закупку'}
                                    </p>
                                </div>
                            )}
                            {availableProducts.map((product) => {
                                const isExisting = existingProductIds.has(product.id);
                                return (
                                    <ProductPickerRow
                                        key={product.id}
                                        product={product}
                                        isExisting={isExisting}
                                        onOpenDetail={() => setDetailProduct(product.id)}
                                    />
                                );
                            })}
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

function ProductPickerRow({
    product,
    isExisting,
    onOpenDetail,
}: {
    product: PickerProduct;
    isExisting: boolean;
    onOpenDetail: () => void;
}) {
    const photoId = getProductPhotoId(product);
    const attributesLine = formatProductAttributesLine(product);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrice = (product as any).pricePerUnit != null ? Number((product as any).pricePerUnit) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minPkgAmount = (product as any).minPackageAmount != null
        ? Number((product as any).minPackageAmount)
        : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minPkgUnit = (product as any).minPackageUnit as string | null | undefined;

    return (
        <Button
            variant="ghost"
            size="default"
            disabled={isExisting}
            onClick={onOpenDetail}
            className={cn(
                'h-auto w-full justify-start gap-3 rounded-2xl border border-border bg-bg-card p-3 text-left',
                !isExisting && 'hover:border-border-strong hover:bg-bg-soft',
                isExisting && 'cursor-not-allowed opacity-60',
            )}
        >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {photoId ? (
                    <img
                        src={`/api/photos/${photoId}`}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-fg-tertiary/40" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-14-semibold text-fg-primary">{product.name}</p>
                    {isExisting && (
                        <Badge type="subtle" variant="success" size="sm">
                            Уже в закупке
                        </Badge>
                    )}
                </div>
                {attributesLine && (
                    <p className="truncate text-12-regular text-fg-tertiary">{attributesLine}</p>
                )}
                {(basePrice != null || minPkgAmount != null) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-12-medium text-fg-secondary tabular-nums">
                        {basePrice != null && basePrice > 0 && (
                            <span>{basePrice.toLocaleString('ru-RU')} ₽/ед</span>
                        )}
                        {minPkgAmount != null && minPkgAmount > 0 && (
                            <>
                                {basePrice != null && basePrice > 0 && (
                                    <span className="text-fg-disabled">·</span>
                                )}
                                <span>
                                    мин. {minPkgAmount} {minPkgUnit ?? 'ед'}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </Button>
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

    // Базовые значения из Product: цена за 1 шт, мин. фасовка, фасовка поставщика.
    // Подставляем их в форму, чтобы админу не приходилось вводить заново.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePricePerUnit = (product as any).pricePerUnit != null ? Number((product as any).pricePerUnit) : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseUnit = (product as any).unit?.shortName ?? 'ед';
    const baseInitialTiers =
        basePricePerUnit > 0
            ? [{ amount: 1, unit: baseUnit, price: basePricePerUnit }]
            : [];

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
                loadSavedDescription={true}
                initialTiers={baseInitialTiers}
                onCancel={onBack}
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
