import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function usePromoCodesList() {
    return trpc.promoCodes.list.useQuery();
}

export function useCreatePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.create.useMutation({
        onSuccess: () => {
            void utils.promoCodes.list.invalidate();
            toast.success('Промокод создан');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useTogglePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.update.useMutation({
        onSuccess: () => {
            void utils.promoCodes.list.invalidate();
            toast.success('Статус обновлён');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeletePromoCode() {
    const utils = trpc.useUtils();
    return trpc.promoCodes.delete.useMutation({
        onSuccess: () => {
            void utils.promoCodes.list.invalidate();
            toast.success('Промокод удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}
