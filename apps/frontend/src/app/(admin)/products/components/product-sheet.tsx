'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct } from '../hooks';
import { ProductForm } from './product-form';
import type { ProductFormExisting } from '../hooks';

interface ProductSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId: number | null;
}

function toNumber(v: string | number | null | undefined): number | undefined {
    if (v == null) return undefined;
    if (typeof v === 'number') return v;
    return Number(v);
}

function transformProduct(raw: any): ProductFormExisting {
    return {
        name: raw.name,
        articleNumber: raw.articleNumber,
        brandId: raw.brandId,
        brand: raw.brand,
        unitCode: raw.unitCode,
        attributeValues: raw.attributeValues,
        characteristicValues: raw.characteristicValues,
        photos: raw.photos,
        pricePerUnit: toNumber(raw.pricePerUnit),
        priceTiers: raw.priceTiers,
        minPackageAmount: toNumber(raw.minPackageAmount),
        minPackageUnit: raw.minPackageUnit,
        supplierPackageAmount: toNumber(raw.supplierPackageAmount),
        supplierPackageUnit: raw.supplierPackageUnit,
        supplierPackagePrice: toNumber(raw.supplierPackagePrice),
        supplierPackageTiers: raw.supplierPackageTiers,
        supplementStep: toNumber(raw.supplementStep),
        referenceStock: toNumber(raw.referenceStock),
        referenceStockUnit: raw.referenceStockUnit,
    };
}

export function ProductSheet({ open, onOpenChange, editId: propEditId }: ProductSheetProps) {
    const [editId, setEditId] = useState<number | null>(propEditId);

    useEffect(() => {
        setEditId(propEditId);
    }, [propEditId]);

    const { data: raw, isLoading: isProductLoading } = useProduct(editId, open);
    const existing = raw ? transformProduct(raw) : undefined;

    return (
        <Sheet
            open={open}
            onOpenChange={(v) => {
                if (!v) setEditId(null);
                onOpenChange(v);
            }}
        >
            <SheetContent className="flex max-h-[100dvh] flex-col overflow-hidden p-0 sm:max-w-xl">
                <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
                    <SheetTitle>{editId ? 'Редактировать товар' : 'Новый товар'}</SheetTitle>
                    <SheetDescription>
                        {editId ? 'Измените данные товара' : 'Заполните данные нового товара'}
                    </SheetDescription>
                </SheetHeader>

                {editId && isProductLoading ? (
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4">
                        <ProductForm
                            key={editId ?? 'new'}
                            editId={editId}
                            existing={existing}
                            onSuccess={() => onOpenChange(false)}
                        />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
