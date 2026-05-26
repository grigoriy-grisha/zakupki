'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useProduct } from '../hooks';
import { ProductForm } from './product-form';
import type { ProductSheetProps } from '../../lib/types';

export function ProductSheet({ open, onOpenChange, editId: propEditId, defaultCategoryId }: ProductSheetProps & { defaultCategoryId?: number | null }) {
    const [editId, setEditId] = useState<number | null>(propEditId);

    useEffect(() => { setEditId(propEditId); }, [propEditId]);

    const { data: existing } = useProduct(editId, open);

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) setEditId(null); onOpenChange(v); }}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{editId ? 'Редактировать товар' : 'Новый товар'}</SheetTitle>
                    <SheetDescription>
                        {editId ? 'Измените данные товара' : 'Заполните данные нового товара'}
                    </SheetDescription>
                </SheetHeader>

                <ProductForm
                    editId={editId}
                    existing={existing}
                    onSuccess={(newId) => {
                        if (newId) setEditId(newId);
                        else onOpenChange(false);
                    }}
                    defaultCategoryId={defaultCategoryId}
                />
            </SheetContent>
        </Sheet>
    );
}
