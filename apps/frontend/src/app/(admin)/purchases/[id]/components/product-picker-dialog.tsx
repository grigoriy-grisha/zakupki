'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Send } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAddPurchaseItems } from '../hooks';
import { PACKAGE_UNITS } from '../../../products/lib';
interface ProductPickerDialogProps {
    purchaseId: number;
    existingProductIds: Set<number>;
}

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
    const [shouldPublish, setShouldPublish] = useState(false);

    const { data: allProducts } = trpc.products.list.useQuery(undefined, { enabled: open });
    const addItems = useAddPurchaseItems(purchaseId);

    const availableProducts = ((allProducts ?? []) as unknown as ProductItem[]).filter(
        (p) => !existingProductIds.has(p.id),
    );

    function toggleProduct(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleAdd(productIdsOverride?: number[]) {
        const ids = productIdsOverride ?? Array.from(selectedIds);
        if (ids.length === 0) return;
        addItems.mutate(
            { purchaseId, productIds: ids, shouldPublish },
            {
                onSuccess: () => {
                    setOpen(false);
                    setSelectedIds(new Set());
                    setDetailProduct(null);
                    setShouldPublish(false);
                },
            },
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) setDetailProduct(null);
            }}
        >
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
                        onToggle={() => toggleProduct(detailProduct)}
                        onAdd={handleAdd}
                        onBack={() => setDetailProduct(null)}
                        shouldPublish={shouldPublish}
                        onPublishChange={setShouldPublish}
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
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleProduct(product.id);
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(product.id)}
                                            onCheckedChange={() => toggleProduct(product.id)}
                                        />
                                    </div>
                                    <div className="flex-1" onClick={() => setDetailProduct(product.id)}>
                                        <p className="text-sm font-medium">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {product.minPackageAmount != null && product.minPackageUnit
                                                ? `${Number(product.minPackageAmount)} ${product.minPackageUnit}`
                                                : '—'}
                                            {' · '}
                                            {Number(product.pricePerUnit).toLocaleString('ru-RU')} ₽/
                                            {product.unit?.shortName ?? ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <Checkbox
                                    checked={shouldPublish}
                                    onCheckedChange={(v) => setShouldPublish(v === true)}
                                />
                                <Send className="h-4 w-4 text-muted-foreground" />
                                Опубликовать в Telegram
                            </label>
                            <Button
                                className="w-full"
                                disabled={selectedIds.size === 0 || addItems.isPending}
                                onClick={() => handleAdd()}
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
    onToggle,
    onAdd,
    onBack,
    shouldPublish,
    onPublishChange,
}: {
    productId: number;
    isSelected: boolean;
    onToggle: () => void;
    onAdd: (productIds?: number[]) => void;
    onBack: () => void;
    shouldPublish: boolean;
    onPublishChange: (v: boolean) => void;
}) {
    const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });
    const utils = trpc.useUtils();
    const updateMutation = trpc.products.update.useMutation({
        onSuccess: () => {
            void utils.products.getById.invalidate({ id: productId });
            void utils.products.list.invalidate();
            toast.success('Товар обновлён');
        },
        onError: (err) => toast.error(err.message),
    });

    if (isLoading) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Загрузка...</div>;
    }

    if (!product) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Товар не найден</div>;
    }

    const priceTiers = Array.isArray(product.priceTiers)
        ? (product.priceTiers as { amount: number; unit: string; price: number }[])
        : [];

    function handleSave(fields: {
        name: string;
        priceTiers: { amount: number; unit: string; price: number }[];
        minPackageAmount: number | null;
        minPackageUnit: string | null;
        supplierPackageAmount: number | null;
        supplierPackageUnit: string | null;
        supplierPackagePrice: number | null;
    }) {
        const firstTier = fields.priceTiers[0];
        if (!firstTier) return;
        const pricePerUnit = firstTier.price / firstTier.amount;
        updateMutation.mutate({
            id: productId,
            name: fields.name,
            pricePerUnit,
            priceTiers: fields.priceTiers,
            minPackageAmount: fields.minPackageAmount ?? undefined,
            minPackageUnit: fields.minPackageUnit ?? undefined,
            supplierPackageAmount: fields.supplierPackageAmount ?? undefined,
            supplierPackageUnit: fields.supplierPackageUnit ?? undefined,
            supplierPackagePrice: fields.supplierPackagePrice ?? undefined,
        });
    }

    return (
        <EditableProductView
            productId={productId}
            product={product}
            priceTiers={priceTiers}
            isSelected={isSelected}
            shouldPublish={shouldPublish}
            onSave={handleSave}
            onToggle={onToggle}
            onAdd={onAdd}
            onBack={onBack}
            onPublishChange={onPublishChange}
            isSaving={updateMutation.isPending}
        />
    );
}

function EditableProductView({
    productId,
    product,
    priceTiers: initialTiers,
    isSelected,
    shouldPublish,
    onSave,
    onToggle,
    onAdd,
    onBack,
    onPublishChange,
    isSaving,
}: {
    productId: number;
    product: any;
    priceTiers: { amount: number; unit: string; price: number }[];
    isSelected: boolean;
    shouldPublish: boolean;
    onSave: (fields: {
        name: string;
        priceTiers: { amount: number; unit: string; price: number }[];
        minPackageAmount: number | null;
        minPackageUnit: string | null;
        supplierPackageAmount: number | null;
        supplierPackageUnit: string | null;
        supplierPackagePrice: number | null;
    }) => void;
    onToggle: () => void;
    onAdd: (productIds?: number[]) => void;
    onBack: () => void;
    onPublishChange: (v: boolean) => void;
    isSaving: boolean;
}) {
    const [name, setName] = useState(product.name);
    const [tiers, setTiers] = useState(
        initialTiers.length > 0 ? initialTiers : [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }],
    );
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(
        product.minPackageAmount ? Number(product.minPackageAmount) : null,
    );
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(product.minPackageUnit ?? PACKAGE_UNITS[0]);
    const [supPkgAmount, setSupPkgAmount] = useState<number | null>(
        product.supplierPackageAmount ? Number(product.supplierPackageAmount) : null,
    );
    const [supPkgUnit, setSupPkgUnit] = useState<string | null>(product.supplierPackageUnit ?? PACKAGE_UNITS[0]);
    const [supPkgPrice, setSupPkgPrice] = useState<number | null>(
        product.supplierPackagePrice ? Number(product.supplierPackagePrice) : null,
    );

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Назад к списку
            </button>

            <div className="space-y-3">
                <div className="space-y-1">
                    <Label>Название</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="space-y-1">
                    <Label>Минимальная фасовка</Label>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            step="0.001"
                            className="flex-1"
                            value={minPkgAmount ?? ''}
                            onChange={(e) => setMinPkgAmount(e.target.value ? Number(e.target.value) : null)}
                        />
                        <select
                            className="border rounded-md px-2 text-sm"
                            value={minPkgUnit ?? PACKAGE_UNITS[0]}
                            onChange={(e) => setMinPkgUnit(e.target.value)}
                        >
                            {PACKAGE_UNITS.map((u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label>Цены</Label>
                    {tiers.map((tier, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input
                                type="number"
                                step="0.001"
                                className="w-20"
                                value={tier.amount}
                                onChange={(e) => {
                                    const next = [...tiers];
                                    next[i] = { ...next[i], amount: Number(e.target.value) };
                                    setTiers(next);
                                }}
                            />
                            <select
                                className="border rounded-md px-2 text-sm"
                                value={tier.unit}
                                onChange={(e) => {
                                    const next = [...tiers];
                                    next[i] = { ...next[i], unit: e.target.value };
                                    setTiers(next);
                                }}
                            >
                                {PACKAGE_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="number"
                                step="0.01"
                                className="flex-1"
                                value={tier.price}
                                onChange={(e) => {
                                    const next = [...tiers];
                                    next[i] = { ...next[i], price: Number(e.target.value) };
                                    setTiers(next);
                                }}
                            />
                            <span className="text-sm text-muted-foreground">₽</span>
                        </div>
                    ))}
                </div>

                <div className="space-y-1">
                    <Label>Фасовка поставщика</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="0.001"
                            className="w-24"
                            value={supPkgAmount ?? ''}
                            onChange={(e) => setSupPkgAmount(e.target.value ? Number(e.target.value) : null)}
                        />
                        <select
                            className="border rounded-md px-2 text-sm"
                            value={supPkgUnit ?? PACKAGE_UNITS[0]}
                            onChange={(e) => setSupPkgUnit(e.target.value)}
                        >
                            {PACKAGE_UNITS.map((u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ))}
                        </select>
                        <span className="text-muted-foreground">—</span>
                        <Input
                            type="number"
                            step="0.01"
                            className="flex-1"
                            value={supPkgPrice ?? ''}
                            onChange={(e) => setSupPkgPrice(e.target.value ? Number(e.target.value) : null)}
                        />
                        <span className="text-sm text-muted-foreground">₽</span>
                    </div>
                </div>
            </div>

            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                    <Button
                        className="flex-1"
                        onClick={() => {
                            onSave({
                                name,
                                priceTiers: tiers,
                                minPackageAmount: minPkgAmount,
                                minPackageUnit: minPkgUnit,
                                supplierPackageAmount: supPkgAmount,
                                supplierPackageUnit: supPkgUnit,
                                supplierPackagePrice: supPkgPrice,
                            });
                            onAdd([productId]);
                        }}
                        disabled={isSaving}
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить и добавить в закупку
                    </Button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={shouldPublish} onCheckedChange={(v) => onPublishChange(v === true)} />
                    <Send className="h-4 w-4 text-muted-foreground" />
                    Опубликовать в Telegram
                </label>
            </div>
        </div>
    );
}
