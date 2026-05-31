'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import { useDeleteProduct } from '../hooks';
import {
    formatProductCatalogCardLines,
    type ProductCatalogCardSource,
} from '../lib';
import { productPhotoUrl } from '@/lib/product-photo-url';

interface CatalogProductCardProps {
    product: ProductCatalogCardSource & {
        id: number;
        name: string;
        inActivePurchase?: boolean;
    };
    onClick: () => void;
}

export function ProductCard({ product, onClick }: CatalogProductCardProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const deleteMutation = useDeleteProduct();
    const utils = trpc.useUtils();
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();

    const descriptionLines = useMemo(
        () => formatProductCatalogCardLines(product, attributeTypes),
        [product, attributeTypes],
    );

    const photo = product.photos?.[0];

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
                className="group overflow-hidden transition-all hover:shadow-md hover:border-primary/20 cursor-pointer"
                onClick={onClick}
            >
                <div className="relative h-44 bg-muted">
                    {photo ? (
                        <img
                            src={productPhotoUrl(photo.id, `${product.id}-${photo.sortOrder}`)}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                    )}
                    {!product.inActivePurchase && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                setConfirmOpen(true);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <CardContent className="space-y-1 p-4">
                    {descriptionLines.length > 0 ? (
                        descriptionLines.map((line, index) => (
                            <p
                                key={`${index}-${line}`}
                                className={
                                    index === 0
                                        ? 'text-sm font-semibold leading-snug'
                                        : 'text-xs leading-relaxed text-muted-foreground'
                                }
                            >
                                {line}
                            </p>
                        ))
                    ) : (
                        <p className="text-sm font-semibold leading-snug">{product.name}</p>
                    )}
                </CardContent>
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
