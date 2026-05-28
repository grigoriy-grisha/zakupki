import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import type { ProductAttributeKind } from '@/app/(admin)/products/lib/schema';

export function useProductAttributeList(kind: ProductAttributeKind) {
    return trpc.productAttributes.list.useQuery({ kind });
}

export function useCreateProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.create.useMutation({
        onSuccess: async () => {
            await utils.productAttributes.list.invalidate();
            toast.success('Значение добавлено');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.update.useMutation({
        onSuccess: async () => {
            await utils.productAttributes.list.invalidate();
            toast.success('Значение обновлено');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.delete.useMutation({
        onSuccess: async () => {
            await utils.productAttributes.list.invalidate();
            toast.success('Значение удалено');
        },
        onError: (err) => toast.error(err.message),
    });
}
