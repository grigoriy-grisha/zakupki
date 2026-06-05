import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

export function useUnitList() {
    return trpc.units.list.useQuery();
}

export function useCreateUnit() {
    const utils = trpc.useUtils();
    return trpc.units.create.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['units', 'list']], 'Единица создана'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useUpdateUnit() {
    const utils = trpc.useUtils();
    return trpc.units.update.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['units', 'list']], 'Единица обновлена'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useDeleteUnit() {
    const utils = trpc.useUtils();
    return trpc.units.delete.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['units', 'list']], 'Единица удалена'),
        onError: (err) => { toast.error(err.message); },
    });
}
