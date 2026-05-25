'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useProduct } from '../hooks';
import { ProductForm } from './product-form';
import type { ProductSheetProps } from '../../lib/types';

export function ProductSheet({ open, onOpenChange, editId }: ProductSheetProps) {
    const { data: existing } = useProduct(editId, open);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
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
                    onSuccess={() => onOpenChange(false)}
                />
            </SheetContent>
        </Sheet>
    );
}
