'use client';

'use client';

import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import type { ProductCreateFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUpdateProduct } from './use-products';
import type { PendingFile } from '../lib/product-form-utils';

export type ProductFormPayload = {
    name: string;
    articleNumber: string | null;
    unitId: number;
    attributeIds: number[];
    characteristics: { characteristicId: number; value: string }[];
};

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

    async function handleCreate(data: ProductCreateFormValues) {
        try {
            const result = await createMutation.mutateAsync(basePayload(data));
            await utils.products.list.invalidate();

            if (pendingFiles.length > 0) {
                for (let i = 0; i < pendingFiles.length; i++) {
                    const formData = new FormData();
                    formData.append('file', pendingFiles[i].file);
                    formData.append('productId', String(result.id));
                    formData.append('sortOrder', String(i));
                    try {
                        const res = await fetch('/api/upload', { method: 'POST', body: formData });
                        if (res.ok) {
                            const { id } = await res.json();
                            setPhotoIds((prev) => [...prev, id]);
                        }
                    } catch {
                        /* skip failed photo */
                    }
                }
                setPendingFiles([]);
                await utils.products.getById.invalidate({ id: result.id });
                await utils.products.list.invalidate();
            }

            toast.success('Товар создан');
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
                ...basePayload(data),
            });
            await utils.products.list.invalidate();
            toast.success('Товар обновлён');
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return false;
        }
    }

    function handleFormSubmit(
        e: React.FormEvent,
        handleSubmit: (
            fn: (data: ProductCreateFormValues) => void | Promise<void>,
        ) => (e?: React.BaseSyntheticEvent) => Promise<void>,
    ) {
        e.preventDefault();
        void handleSubmit(async (data) => {
            const ok = isCreating ? await handleCreate(data) : await handleUpdate(data);
            if (ok) onSuccess();
        })();
    }

    async function handleDeletePhoto(id: number) {
        await deletePhotoMutation.mutateAsync({ id });
    }

    return {
        handleFormSubmit,
        handleDeletePhoto,
        isPending: createMutation.isPending || updateMutation.isPending,
    };
}
