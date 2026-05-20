import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useUpdatePurchaseStatus(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.updateStatus.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Статус обновлён');
        },
        onError: (err) => toast.error(err.message),
    });
}
