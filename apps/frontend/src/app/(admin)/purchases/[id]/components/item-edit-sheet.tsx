'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { PurchaseProductEditForm } from './purchase-product-edit-form';
import type { PurchaseDetail } from '../lib/types';

export interface ItemEditSheetProps {
    purchaseItemId: number | null;
    open: boolean;
    onClose: () => void;
    purchaseId: number;
}

export function ItemEditSheet({ purchaseItemId, open, onClose, purchaseId }: ItemEditSheetProps) {
    const utils = trpc.useUtils();
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId }, { enabled: open });
    const items = ((purchase as unknown as PurchaseDetail | null)?.items) ?? [];
    const item = items.find((i) => i.id === purchaseItemId);

    const updateMutation = trpc.purchases.updateItemProduct.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.products.list.invalidate();
            toast.success('Товар обновлён');
            onClose();
        },
        onError: (err) => toast.error(err.message),
    });

    if (!open) return null;

    const product = item?.product;
    const tiers: { amount: number; unit: string; price: number }[] =
        product && Array.isArray(product.priceTiers) ? product.priceTiers : [];
    const published = !!item?.tgMessageId;

    return (
        <Sheet
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>
                        {item
                            ? `Редактировать товар${published ? ' · Пост в TG обновится' : ''}`
                            : 'Редактировать товар'}
                    </SheetTitle>
                </SheetHeader>
                {isLoading || !item || !product ? (
                    <Skeleton className="mt-4 h-64 w-full" />
                ) : (
                    <PurchaseProductEditForm
                        key={product.id}
                        product={{ ...product, supplementStep: (item as any).supplementStep }}
                        loadSavedDescription
                        purchaseTag={(purchase as unknown as PurchaseDetail)?.tag}
                        initialTiers={tiers}
                        onSave={(data) => updateMutation.mutate({ purchaseItemId: purchaseItemId!, product: data, priceOverride: data.priceOverride ?? null })}
                        isSaving={updateMutation.isPending}
                        submitLabel={published ? 'Сохранить и обновить пост в TG' : 'Сохранить'}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
