import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useSupplierList() {
    return trpc.suppliers.list.useQuery();
}

export function useCreateSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.create.useMutation({
        onSuccess: async () => {
            await utils.suppliers.list.invalidate();
            toast.success('Поставщик добавлен');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.update.useMutation({
        onSuccess: async () => {
            await utils.suppliers.list.invalidate();
            toast.success('Поставщик обновлён');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.delete.useMutation({
        onSuccess: async () => {
            await utils.suppliers.list.invalidate();
            toast.success('Поставщик удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}
