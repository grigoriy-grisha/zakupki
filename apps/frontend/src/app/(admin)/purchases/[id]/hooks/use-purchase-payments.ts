import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useConfirmPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.confirm.useMutation({
        onSuccess: () => {
            void utils.payments.getByPurchase.invalidate({ purchaseId });
            toast.success('Оплата подтверждена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useRejectPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.reject.useMutation({
        onSuccess: () => {
            void utils.payments.getByPurchase.invalidate({ purchaseId });
            toast.success('Оплата отклонена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useAddManualPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.addPayment.useMutation({
        onSuccess: () => {
            void utils.payments.getByPurchase.invalidate({ purchaseId });
            toast.success('Оплата добавлена');
        },
        onError: (err) => toast.error(err.message),
    });
}
