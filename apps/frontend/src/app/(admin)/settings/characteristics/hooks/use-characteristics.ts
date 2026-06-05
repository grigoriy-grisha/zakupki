import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

export function useCharacteristicList() {
    return trpc.characteristics.list.useQuery();
}

export function useCreateCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.create.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['characteristics', 'list']], 'Характеристика добавлена'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useUpdateCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.update.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['characteristics', 'list']], 'Характеристика обновлена'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useDeleteCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.delete.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['characteristics', 'list'], ['attributeTypes', 'list']], 'Характеристика удалена'),
        onError: (err) => { toast.error(err.message); },
    });
}
