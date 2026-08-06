'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Lock, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/client/trpc';
import { useDeleteProduct } from '../hooks';
import { formatProductCatalogCardLines, type ProductCatalogCardSource } from '../lib';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';

interface CatalogProductCardProps {
    product: ProductCatalogCardSource & {
        id: number;
        name: string;
        inActivePurchase?: boolean;
    };
    onClick: () => void;
}

/** Максимум meta-строк (характеристики/единицы), показываемых на карточке каталога. */
const MAX_META_LINES = 2;

export function ProductCard({ product, onClick }: CatalogProductCardProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const deleteMutation = useDeleteProduct();
    const utils = trpc.useUtils();
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();

    const { nameLine, titleLine, metaLines } = useMemo(() => {
        const lines = formatProductCatalogCardLines(product, attributeTypes);
        return {
            nameLine: lines.find((l) => l.role === 'name'),
            titleLine: lines.find((l) => l.role === 'title'),
            metaLines: lines.filter((l) => l.role === 'meta'),
        };
    }, [product, attributeTypes]);

    const photo = product.photos?.[0];
    const visibleMetaLines = metaLines.slice(0, MAX_META_LINES);
    const hiddenMetaCount = Math.max(0, metaLines.length - MAX_META_LINES);

    async function handleDelete() {
        try {
            await deleteMutation.mutateAsync({ id: product.id });
            await utils.products.list.invalidate();
            toast.success('Товар удалён');
            setConfirmOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
        }
    }

    return (
        <>
            <Card
                rounded="2xl"
                className={cn(
                    'group relative flex h-full flex-col cursor-pointer overflow-hidden border py-0 transition-all duration-200 ease-out',
                    'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg',
                )}
                onClick={onClick}
            >
                {/* ── Фото ── */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-soft sm:aspect-square">
                    {photo ? (
                        <div className="h-full w-full overflow-hidden transition-transform duration-500 ease-out group-hover:scale-105">
                            <ProductPhotoPreview
                                photoId={photo.id}
                                photoIds={product.photos?.map((p) => p.id)}
                                alt={product.name}
                                fill
                            />
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Package className="h-10 w-10 text-fg-tertiary/40" />
                        </div>
                    )}

                    {/* Бейдж «В закупке» — объясняет отсутствие кнопки удаления */}
                    {product.inActivePurchase && (
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-1 flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-11-medium leading-none text-white backdrop-blur-md">
                            <Lock className="size-2.5" />
                            В закупке
                        </div>
                    )}

                    {/* Кнопка удаления — только для товаров вне закупки */}
                    {!product.inActivePurchase && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1.5 right-1.5 z-[1] h-7 w-7 opacity-70 transition-opacity group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                setConfirmOpen(true);
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {/* ── Контент ── */}
                <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3.5">
                    {/* Название */}
                    {nameLine ? (
                        <p className="line-clamp-2 text-13-semibold leading-snug text-fg-primary transition-colors group-hover:text-primary sm:text-14-semibold">
                            {nameLine.text}
                        </p>
                    ) : (
                        <p className="line-clamp-2 text-13-semibold leading-snug text-fg-primary transition-colors group-hover:text-primary sm:text-14-semibold">
                            {product.name}
                        </p>
                    )}

                    {/* Подзаголовок (бренд + тип) */}
                    {titleLine && (
                        <p className="line-clamp-1 text-12-medium leading-snug text-fg-secondary">
                            {titleLine.text}
                        </p>
                    )}

                    {/* Характеристики / единицы — максимум MAX_META_LINES строк */}
                    {visibleMetaLines.map((line, index) => (
                        <p key={`${index}-${line.text}`} className="line-clamp-1 text-11-regular leading-snug text-fg-tertiary">
                            {line.text}
                        </p>
                    ))}

                    {/* Скрытые характеристики */}
                    {hiddenMetaCount > 0 && (
                        <p className="text-11-medium leading-snug text-fg-tertiary transition-colors group-hover:text-fg-secondary">
                            +{hiddenMetaCount} ещё
                        </p>
                    )}
                </div>
            </Card>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>Удалить товар?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Товар <strong>{product.name}</strong> будет удалён без возможности восстановления.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                            Отмена
                        </Button>
                        <Button variant="destructive" disabled={deleteMutation.isPending} onClick={handleDelete}>
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Удалить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
