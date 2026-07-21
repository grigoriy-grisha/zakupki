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

/**
 * Admin: record an offline / out-of-band payment for a participant. The row is
 * created as CONFIRMED on the server (see PaymentRepository.create) so it
 * immediately counts towards the participant's `paid` total — no separate
 * confirm step. Invalidates both the payments list and the purchase itself:
 * payments feed the participant card's `paid`/`pending` stats, and
 * getById backs the items-tab totals.
 */
export function useAddPayment(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.payments.addPayment.useMutation({
        onSuccess: () => {
            void utils.payments.getByPurchase.invalidate({ purchaseId });
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Оплата добавлена');
        },
        onError: (err) => toast.error(err.message),
    });
}
