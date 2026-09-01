import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useConfirmPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.confirm.useMutation(
        mutationOptions({
            invalidate: () => void utils.payments.getByPurchase.invalidate({ purchaseId }),
            success: 'Оплата подтверждена',
        }),
    );
}

export function useRejectPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.reject.useMutation(
        mutationOptions({
            invalidate: () => void utils.payments.getByPurchase.invalidate({ purchaseId }),
            success: 'Оплата отклонена',
        }),
    );
}

export function useAddPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.addPayment.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.payments.getByPurchase.invalidate({ purchaseId });
                void utils.purchases.getById.invalidate({ id: purchaseId });
            },
            success: 'Оплата добавлена',
        }),
    );
}
