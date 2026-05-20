import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useProductList(search?: string) {
    return trpc.products.list.useQuery({ search: search || undefined });
}

export function useProduct(id: number | null, enabled: boolean) {
    return trpc.products.getById.useQuery(
        { id: id! },
        { enabled: !!id && enabled },
    );
}

export function useUnits(enabled: boolean) {
    return trpc.units.list.useQuery(undefined, { enabled });
}

export function useCreateProduct() {
    const utils = trpc.useUtils();
    return trpc.products.create.useMutation({
        onSuccess: async () => {
            await utils.products.list.invalidate();
            toast.success('Товар создан');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateProduct() {
    const utils = trpc.useUtils();
    return trpc.products.update.useMutation({
        onSuccess: async () => {
            await utils.products.list.invalidate();
            toast.success('Товар обновлён');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteProduct() {
    const utils = trpc.useUtils();
    return trpc.products.delete.useMutation({
        onSuccess: async () => {
            await utils.products.list.invalidate();
            toast.success('Товар удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeletePhoto() {
    return trpc.products.deletePhoto.useMutation({
        onError: (err) => toast.error(err.message),
    });
}
