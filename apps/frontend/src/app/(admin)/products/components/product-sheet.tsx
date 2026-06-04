'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct } from '../hooks';
import { ProductForm } from './product-form';
interface ProductSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId: number | null;
}

export function ProductSheet({ open, onOpenChange, editId: propEditId }: ProductSheetProps) {
    const [editId, setEditId] = useState<number | null>(propEditId);

    useEffect(() => {
        setEditId(propEditId);
    }, [propEditId]);

    const { data: existing, isLoading: isProductLoading } = useProduct(editId, open);

    return (
        <Sheet
            open={open}
            onOpenChange={(v) => {
                if (!v) setEditId(null);
                onOpenChange(v);
            }}
        >
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{editId ? 'Редактировать товар' : 'Новый товар'}</SheetTitle>
                    <SheetDescription>
                        {editId ? 'Измените данные товара' : 'Заполните данные нового товара'}
                    </SheetDescription>
                </SheetHeader>

                {editId && isProductLoading ? (
                    <div className="space-y-4 px-4 pt-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <ProductForm
                        key={editId ?? 'new'}
                        editId={editId}
                        existing={existing}
                        onSuccess={() => onOpenChange(false)}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
