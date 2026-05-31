import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

// ── Типы атрибутов (структура каталога) ──

export function useAttributeTypes() {
    return trpc.attributeTypes.list.useQuery();
}

async function invalidateAttributeTypeDependents(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.attributeTypes.list.invalidate(),
        utils.products.list.invalidate(),
        utils.products.getById.invalidate(),
        utils.purchases.list.invalidate(),
        utils.purchases.getById.invalidate(),
    ]);
}

export function useCreateAttributeType() {
    const utils = trpc.useUtils();
    return trpc.attributeTypes.create.useMutation({
        onSuccess: async () => {
            await invalidateAttributeTypeDependents(utils);
            toast.success('Тип добавлен');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdateAttributeType() {
    const utils = trpc.useUtils();
    return trpc.attributeTypes.update.useMutation({
        onSuccess: async () => {
            await invalidateAttributeTypeDependents(utils);
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useMoveAttributeType() {
    const utils = trpc.useUtils();
    return trpc.attributeTypes.move.useMutation({
        onSuccess: async () => {
            await invalidateAttributeTypeDependents(utils);
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteAttributeType() {
    const utils = trpc.useUtils();
    return trpc.attributeTypes.delete.useMutation({
        onSuccess: async () => {
            await invalidateAttributeTypeDependents(utils);
            await utils.productAttributes.list.invalidate();
            toast.success('Тип удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}

// ── Значения справочников ──

export function useProductAttributeList(typeId?: number) {
    return trpc.productAttributes.list.useQuery({ typeId });
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
            await Promise.all([
                utils.productAttributes.list.invalidate(),
                utils.products.list.invalidate(),
                utils.products.getById.invalidate(),
                utils.purchases.list.invalidate(),
                utils.purchases.getById.invalidate(),
            ]);
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
