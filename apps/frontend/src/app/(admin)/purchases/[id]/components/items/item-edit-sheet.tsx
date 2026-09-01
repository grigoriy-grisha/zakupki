'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

import { usePurchaseDetail } from '../../hooks/use-purchase-detail';
import { useUpdateItemProduct } from '../../hooks/use-purchase-items';
import { PurchaseProductEditForm } from './purchase-product-edit-form';

export interface ItemEditSheetProps {
    purchaseItemId: number | null;
    open: boolean;
    onClose: () => void;
    purchaseId: number;
}

export function ItemEditSheet({ purchaseItemId, open, onClose, purchaseId }: ItemEditSheetProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId, { enabled: open });
    const items = purchase?.items ?? [];
    const item = items.find((i) => i.id === purchaseItemId);

    const updateMutation = useUpdateItemProduct(purchaseId);

    if (!open) return null;

    const product = item?.product;
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
                    <div className="px-4 pb-4">
                        <Skeleton className="mt-4 h-64 w-full" />
                    </div>
                ) : (
                    <div className="px-4 pb-4">
                        <PurchaseProductEditForm
                            key={item.id}
                            product={product}
                            initialPurchaseFields={{
                                supplierId: item.supplierId ?? null,
                                description: item.description ?? null,
                                // Новая модель цен:
                                pricePerPackCurrency: item.pricePerPackCurrency ?? null,
                                currencyId: item.currencyId ?? null,
                                packAmount: item.packAmount ?? null,
                                packUnit: item.packUnit ?? null,
                                orgFeePercentOverride: item.orgFeePercentOverride ?? null,
                                // Добор и лимиты:
                                minPackageAmount: item.minPackageAmount ?? null,
                                minPackageUnit: item.minPackageUnit ?? null,
                                supplementStep: item.supplementStep ?? null,
                                supplierLimit: item.supplierLimit ?? null,
                                supplierLimitUnit: item.supplierLimitUnit ?? null,
                                targetRemainder: item.targetRemainder ?? null,
                            }}
                            loadSavedDescription
                            purchaseTag={purchase?.tag}
                            currencyRates={purchase?.currencyRates ?? []}
                            onSave={(data) =>
                                updateMutation.mutate(
                                    {
                                        purchaseItemId: purchaseItemId!,
                                        product: data,
                                    },
                                    { onSuccess: () => onClose() },
                                )
                            }
                            isSaving={updateMutation.isPending}
                            submitLabel={published ? 'Сохранить и обновить пост в TG' : 'Сохранить'}
                        />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
