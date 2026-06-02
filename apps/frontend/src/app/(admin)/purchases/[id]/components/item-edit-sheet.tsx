'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { PurchaseProductEditForm } from './purchase-product-edit-form';

export interface ItemEditSheetProps {
    purchaseItemId: number | null;
    open: boolean;
    onClose: () => void;
    purchaseId: number;
}

export function ItemEditSheet({ purchaseItemId, open, onClose, purchaseId }: ItemEditSheetProps) {
    const utils = trpc.useUtils();
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery(
        { id: purchaseId },
        { enabled: open },
    );
    const items = (purchase as { items?: any[] })?.items ?? [];
    const item = items.find((i: any) => i.id === purchaseItemId);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = item?.product as any;
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
                        product={product}
                        loadSavedDescription
                        purchaseTag={purchase?.tag}
                        initialTiers={tiers}
                        onSave={(data) =>
                            updateMutation.mutate({ purchaseItemId: purchaseItemId!, product: data })
                        }
                        isSaving={updateMutation.isPending}
                        submitLabel={published ? 'Сохранить и обновить пост в TG' : 'Сохранить'}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
