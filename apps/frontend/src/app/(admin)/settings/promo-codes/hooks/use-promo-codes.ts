import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

export function usePromoCodesList() {
    return trpc.promoCodes.list.useQuery();
}

export function useCreatePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.create.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['promoCodes', 'list']], 'Промокод создан'),
        onError: (err) => {
            toast.error(err.message);
        },
    });
}

export function useTogglePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.update.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['promoCodes', 'list']], 'Статус обновлён'),
        onError: (err) => {
            toast.error(err.message);
        },
    });
}

export function useDeletePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.delete.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['promoCodes', 'list']], 'Промокод удалён'),
        onError: (err) => {
            toast.error(err.message);
        },
    });
}
