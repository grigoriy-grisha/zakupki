import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useAddPurchaseItems(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.addItems.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товары добавлены');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useRemovePurchaseItem(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.removeItem.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товар удалён из закупки');
        },
        onError: (err) => toast.error(err.message),
    });
}
