import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

export function useSupplierList() {
    return trpc.suppliers.list.useQuery();
}

export function useCreateSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.create.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['suppliers', 'list']], 'Поставщик добавлен'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useUpdateSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.update.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['suppliers', 'list']], 'Поставщик обновлён'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useDeleteSupplier() {
    const utils = trpc.useUtils();
    return trpc.suppliers.delete.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['suppliers', 'list']], 'Поставщик удалён'),
        onError: (err) => { toast.error(err.message); },
    });
}
