import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useCharacteristicList() {
    return trpc.characteristics.list.useQuery();
}

export function useCreateCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.create.useMutation({
        onSuccess: async () => {
            await utils.characteristics.list.invalidate();
            toast.success('Характеристика добавлена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.update.useMutation({
        onSuccess: async () => {
            await utils.characteristics.list.invalidate();
            toast.success('Характеристика обновлена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useMoveCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.move.useMutation({
        onSuccess: async () => {
            await utils.characteristics.list.invalidate();
            await utils.productAttributes.list.invalidate();
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteCharacteristic() {
    const utils = trpc.useUtils();
    return trpc.characteristics.delete.useMutation({
        onSuccess: async () => {
            await utils.characteristics.list.invalidate();
            await utils.attributeTypes.list.invalidate();
            toast.success('Характеристика удалена');
        },
        onError: (err) => toast.error(err.message),
    });
}
