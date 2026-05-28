'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import { useDeleteProduct } from '../hooks';

interface CatalogProductCardProps {
    product: {
        id: number;
        name: string;
        unit: { shortName: string } | null;
        minPackageAmount: string | number | null;
        minPackageUnit: string | null;
        photos: { id: number }[];
        inActivePurchase?: boolean;
    };
    onClick: () => void;
}

export function ProductCard({ product, onClick }: CatalogProductCardProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const deleteMutation = useDeleteProduct();
    const utils = trpc.useUtils();

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
                            src={`/api/photos/${photo.id}`}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                    )}
                    <Badge className="absolute bottom-2 right-2">{product.unit?.shortName ?? ''}</Badge>
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

                <CardContent className="p-4">
                    <h3 className="font-semibold leading-tight line-clamp-1">{product.name}</h3>
                    {product.minPackageAmount != null && product.minPackageUnit && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Мин. фасовка: {Number(product.minPackageAmount)} {product.minPackageUnit}
                        </p>
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
