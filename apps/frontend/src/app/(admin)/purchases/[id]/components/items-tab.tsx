'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { NovelEditor } from '@/components/ui/novel-editor';
import { toast } from 'sonner';
import { useRemovePurchaseItem, useToggleShouldPublish } from '../hooks';
import { ProductPickerDialog } from './product-picker-dialog';
import { PhotoUploader } from '../../../products/components/photo-uploader';
import { PACKAGE_UNITS } from '../../../products/lib';
interface ItemsTabProps {
    purchaseId: number;
    onEditSupplement?: () => void;
}

export function ItemsTab({ purchaseId, onEditSupplement }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const removeItem = useRemovePurchaseItem(purchaseId);
    const togglePublish = useToggleShouldPublish(purchaseId);

    const [editItem, setEditItem] = useState<number | null>(null);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    const isDraft = purchase.status === 'DRAFT';
    const isSupplement = purchase.status === 'SUPPLEMENT';
    const existingProductIds = new Set(purchase.items.map((item) => item.productId));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium">Товары в закупке</h2>
                    {isSupplement && onEditSupplement && (
                        <Button variant="outline" size="sm" onClick={onEditSupplement}>
                            Редактировать остатки
                        </Button>
                    )}
                </div>
                <ProductPickerDialog purchaseId={purchaseId} existingProductIds={existingProductIds} />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Фото</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Мин. фасовка</TableHead>
                            <TableHead>Цена/ед</TableHead>
                            <TableHead>Заказов</TableHead>
                            <TableHead className="text-center">TG</TableHead>
                            {isSupplement && <TableHead className="text-center">Доступно</TableHead>}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchase.items.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={isSupplement ? 8 : 7}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {purchase.items.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const published = !!item.tgMessageId;
                            return (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-accent/50"
                                    onClick={() => setEditItem(item.id)}
                                >
                                    <TableCell>
                                        {item.product.photos?.[0] ? (
                                            <img
                                                src={`/api/photos/${item.product.photos[0].id}`}
                                                alt={item.product.name}
                                                className="h-10 w-10 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                                                Нет
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.product.name}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {item.product.minPackageAmount != null && item.product.minPackageUnit
                                            ? `${Number(item.product.minPackageAmount)} ${item.product.minPackageUnit}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {Number(item.priceOverride ?? item.product.pricePerUnit).toLocaleString(
                                            'ru-RU',
                                        )}{' '}
                                        ₽
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        {published ? (
                                            <Badge variant="outline">✓</Badge>
                                        ) : (
                                            <Checkbox
                                                checked={item.shouldPublish}
                                                disabled={!isDraft || togglePublish.isPending}
                                                onCheckedChange={(v) => {
                                                    if (typeof v === 'boolean') {
                                                        togglePublish.mutate({ purchaseItemId: item.id, value: v });
                                                    }
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    {isSupplement && (
                                        <TableCell className="text-center">
                                            {item.availableQty !== null && item.availableQty !== undefined ? (
                                                <Badge
                                                    variant={Number(item.availableQty) > 0 ? 'outline' : 'destructive'}
                                                    className="font-mono"
                                                >
                                                    {Number(item.availableQty)} {shortName}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">∞</span>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => removeItem.mutate({ purchaseItemId: item.id })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <ItemEditSheet
                purchaseItemId={editItem}
                open={editItem !== null}
                onClose={() => setEditItem(null)}
                purchaseId={purchaseId}
            />
        </div>
    );
}

function ItemEditSheet({
    purchaseItemId,
    open,
    onClose,
    purchaseId,
}: {
    purchaseItemId: number | null;
    open: boolean;
    onClose: () => void;
    purchaseId: number;
}) {
    const utils = trpc.useUtils();
    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);

    const updateMutation = trpc.purchases.updateItemProduct.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.products.list.invalidate();
            toast.success('Товар обновлён');
            onClose();
        },
        onError: (err) => toast.error(err.message),
    });

    const deletePhotoMutation = trpc.products.deletePhoto.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.products.list.invalidate();
        },
        onError: (err) => toast.error(err.message),
    });

    if (!item) return null;
    const product: Record<string, any> = item.product;
    const tiers: { amount: number; unit: string; price: number }[] = Array.isArray(product.priceTiers)
        ? product.priceTiers
        : [];
    const published = !!item.tgMessageId;

    return (
        <Sheet
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Редактировать товар {published && '· Пост в TG обновится'}</SheetTitle>
                </SheetHeader>
                <ItemEditForm
                    product={product}
                    initialTiers={tiers}
                    published={published}
                    purchaseItemId={purchaseItemId!}
                    onSave={(data) => updateMutation.mutate({ purchaseItemId: purchaseItemId!, product: data })}
                    onDeletePhoto={async (photoId) => {
                        await deletePhotoMutation.mutateAsync({ id: photoId });
                    }}
                    isSaving={updateMutation.isPending}
                />
            </SheetContent>
        </Sheet>
    );
}

function ItemEditForm({
    product,
    initialTiers,
    published,
    purchaseItemId,
    onSave,
    onDeletePhoto,
    isSaving,
}: {
    product: any;
    initialTiers: { amount: number; unit: string; price: number }[];
    published: boolean;
    purchaseItemId: number;
    onSave: (data: any) => void;
    onDeletePhoto: (photoId: number) => Promise<void>;
    isSaving: boolean;
}) {
    const [name, setName] = useState(product.name);
    const [description, setDescription] = useState(product.description ?? '');
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
    const [availAmount, setAvailAmount] = useState<number | null>(
        product.availableAmount ? Number(product.availableAmount) : null,
    );
    const [availUnit, setAvailUnit] = useState<string | null>(product.availableUnit ?? PACKAGE_UNITS[0]);
    const [photoIds, setPhotoIds] = useState<number[]>((product.photos ?? []).map((p: any) => p.id));

    function handleSave() {
        const firstTier = tiers[0];
        if (!firstTier) return;
        const pricePerUnit = firstTier.price / firstTier.amount;

        onSave({
            name,
            description: description || undefined,
            pricePerUnit,
            priceTiers: tiers,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
            supplierPackageAmount: supPkgAmount,
            supplierPackageUnit: supPkgUnit,
            supplierPackagePrice: supPkgPrice,
            availableAmount: availAmount,
            availableUnit: availUnit,
        });
    }

    return (
        <div className="space-y-4 px-4">
            <div className="space-y-1">
                <Label>Название</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1">
                <Label>Описание</Label>
                <NovelEditor value={description} onChange={setDescription} placeholder="Описание товара..." />
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
                <div className="flex items-center justify-between">
                    <Label>Цены</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTiers((prev) => [...prev, { amount: 1, unit: PACKAGE_UNITS[0], price: 0 }])}
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Добавить
                    </Button>
                </div>
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
                        {tiers.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
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

            <div className="space-y-1">
                <Label>Свободно</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        className="flex-1"
                        value={availAmount ?? ''}
                        onChange={(e) => setAvailAmount(e.target.value ? Number(e.target.value) : null)}
                    />
                    <select
                        className="border rounded-md px-2 text-sm"
                        value={availUnit ?? PACKAGE_UNITS[0]}
                        onChange={(e) => setAvailUnit(e.target.value)}
                    >
                        {PACKAGE_UNITS.map((u) => (
                            <option key={u} value={u}>
                                {u}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <PhotoUploader
                photoIds={photoIds}
                onPhotoIdsChange={setPhotoIds}
                productId={product.id}
                onDeletePhoto={onDeletePhoto}
            />

            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить {published && 'и обновить пост в TG'}
            </Button>
        </div>
    );
}
