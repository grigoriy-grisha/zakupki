import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useProductList(search?: string, categoryId?: number | null) {
    return trpc.products.list.useQuery({
        search: search || undefined,
        categoryId: categoryId ?? undefined,
    });
}

export function useProduct(id: number | null, enabled: boolean) {
    return trpc.products.getById.useQuery({ id: id! }, { enabled: !!id && enabled });
}

export function useUnits(enabled: boolean) {
    return trpc.units.list.useQuery(undefined, { enabled });
}

export function useCreateProduct() {
    return trpc.products.create.useMutation();
}

export function useUpdateProduct() {
    return trpc.products.update.useMutation();
}

export function useDeleteProduct() {
    return trpc.products.delete.useMutation();
}

export function useDeletePhoto() {
    return trpc.products.deletePhoto.useMutation();
}
