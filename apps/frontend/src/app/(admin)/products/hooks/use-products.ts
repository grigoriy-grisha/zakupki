
import { trpc } from '@/lib/client/trpc';

export function useProductList(search?: string) {
    return trpc.products.list.useQuery({
        search: search || undefined,
    });
}

export function useProduct(id: number | null, enabled: boolean) {
    return trpc.products.getById.useQuery({ id: id! }, { enabled: !!id && enabled });
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
