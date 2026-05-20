import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useUnitList() {
    return trpc.units.list.useQuery();
}

export function useCreateUnit() {
    const utils = trpc.useUtils();
    return trpc.units.create.useMutation({
        onSuccess: () => {
            void utils.units.list.invalidate();
            toast.success('Единица создана');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateUnit() {
    const utils = trpc.useUtils();
    return trpc.units.update.useMutation({
        onSuccess: () => {
            void utils.units.list.invalidate();
            toast.success('Единица обновлена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteUnit() {
    const utils = trpc.useUtils();
    return trpc.units.delete.useMutation({
        onSuccess: () => {
            void utils.units.list.invalidate();
            toast.success('Единица удалена');
        },
        onError: (err) => toast.error(err.message),
    });
}
