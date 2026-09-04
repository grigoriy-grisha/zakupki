'use client';

import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import type { PendingFile } from '@/lib/product-form-utils';
import { uploadProductPhoto } from '@/lib/product-photo/upload';

import type { ProductCreateFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUpdateProduct } from './use-products';

export type ProductFormPayload = {
    name: string;
    articleNumber: string | null;
    unitCode: string;
    attributeIds: number[];
    characteristics: { characteristicId: number; value: string }[];
};

function asRouterPayload(payload: ProductFormPayload) {
    return { ...payload, unitCode: payload.unitCode as 'gram' | 'piece' | 'tube' };
}

export function useProductFormSubmit({
    editId,
    isCreating,
    basePayload,
    pendingFiles,
    setPhotoIds,
    setPendingFiles,
    onSuccess,
}: {
    editId: number | null;
    isCreating: boolean;
    basePayload: (data: ProductCreateFormValues) => ProductFormPayload;
    pendingFiles: PendingFile[];
    setPhotoIds: React.Dispatch<React.SetStateAction<number[]>>;
    setPendingFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>;
    onSuccess: () => void;
}) {
    const utils = trpc.useUtils();
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deletePhotoMutation = useDeletePhoto();

    async function refreshProductCatalog(productId?: number) {
        await utils.products.list.refetch();
        if (productId != null) {
            await utils.products.getById.refetch({ id: productId });
        }
    }

    async function handleCreate(data: ProductCreateFormValues) {
        try {
            const payload = asRouterPayload(basePayload(data));
            const result = await createMutation.mutateAsync(payload);

            if (pendingFiles.length > 0) {
                for (let i = 0; i < pendingFiles.length; i++) {
                    try {
                        const id = await uploadProductPhoto(pendingFiles[i].file, result.id, i);
                        setPhotoIds((prev) => [...prev, id]);
                    } catch {
                        /* skip failed photo */
                    }
                }
                setPendingFiles([]);
            }

            toast.success('Товар создан');
            void refreshProductCatalog(result.id);
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return false;
        }
    }

    async function handleUpdate(data: ProductCreateFormValues) {
        if (!editId) return false;
        try {
            await updateMutation.mutateAsync({
                id: editId,
                ...asRouterPayload(basePayload(data)),
            });
            toast.success('Товар обновлён');
            void refreshProductCatalog(editId);
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return false;
        }
    }

    async function submitForm(data: ProductCreateFormValues) {
        const ok = isCreating ? await handleCreate(data) : await handleUpdate(data);
        if (ok) onSuccess();
    }

    async function handleDeletePhoto(id: number) {
        await deletePhotoMutation.mutateAsync({ id });
    }

    return {
        submitForm,
        handleDeletePhoto,
        isPending: createMutation.isPending || updateMutation.isPending,
    };
}
