'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import { useDeleteProduct } from '../hooks';
import { formatProductCatalogCardLines, type CatalogCardLineRole, type ProductCatalogCardSource } from '../lib';
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

    const { nameLine, titleLine, metaLines } = useMemo(() => {
        const lines = formatProductCatalogCardLines(product, attributeTypes);
        return {
            nameLine: lines.find((l) => l.role === 'name'),
            titleLine: lines.find((l) => l.role === 'title'),
            metaLines: lines.filter((l) => l.role === 'meta'),
        };
    }, [product, attributeTypes]);

    const photo = product.photos?.[0];

    function catalogLineClass(role: CatalogCardLineRole): string {
        if (role === 'name') {
            return 'line-clamp-3 text-sm font-semibold leading-snug sm:min-h-[3rem] sm:text-base';
        }
        if (role === 'title') {
            return 'line-clamp-2 text-xs font-medium leading-snug text-muted-foreground';
        }
        return 'line-clamp-1 text-[11px] leading-snug text-muted-foreground';
    }

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
                className="group flex cursor-pointer flex-row gap-0 overflow-hidden py-0 transition-all hover:border-primary/20 hover:shadow-md sm:flex-col"
                onClick={onClick}
            >
                <div className="relative aspect-square w-20 shrink-0 bg-muted sm:w-full">
                    {photo ? (
                        <img
                            src={productPhotoUrl(photo.id, `${product.id}-${(photo as { sortOrder?: number }).sortOrder ?? 0}`)}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/30 sm:h-10 sm:w-10" />
                        </div>
                    )}
                    {!product.inActivePurchase && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1.5 right-1.5 h-7 w-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                setConfirmOpen(true);
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                <CardContent className="flex min-w-0 flex-1 flex-col justify-start gap-0.5 px-2 py-2 sm:flex-none sm:px-2.5 sm:py-2">
                    {nameLine ? (
                        <p className={catalogLineClass('name')}>{nameLine.text}</p>
                    ) : (
                        <p className={catalogLineClass('name')}>{product.name}</p>
                    )}
                    {titleLine && <p className={catalogLineClass('title')}>{titleLine.text}</p>}
                    {metaLines.map((line, index) => (
                        <p key={`${index}-${line.text}`} className={catalogLineClass('meta')}>
                            {line.text}
                        </p>
                    ))}
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
