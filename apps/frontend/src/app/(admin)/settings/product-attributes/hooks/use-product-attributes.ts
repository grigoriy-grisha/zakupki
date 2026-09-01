import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useAttributeTypes() {
    return trpc.attributeTypes.list.useQuery();
}

function useInvalidateAttributeTypeDependents() {
    const utils = trpc.useUtils();
    return () => {
        void utils.attributeTypes.list.invalidate();
        void utils.products.list.invalidate();
        void utils.products.getById.invalidate();
        void utils.purchases.list.invalidate();
        void utils.purchases.getById.invalidate();
    };
}

export function useCreateAttributeType() {
    const invalidateDependents = useInvalidateAttributeTypeDependents();
    return trpc.attributeTypes.create.useMutation(
        mutationOptions({ invalidate: invalidateDependents, success: 'Тип добавлен' }),
    );
}

export function useUpdateAttributeType() {
    const invalidateDependents = useInvalidateAttributeTypeDependents();
    return trpc.attributeTypes.update.useMutation(mutationOptions({ invalidate: invalidateDependents }));
}

export function useMoveAttributeType() {
    const invalidateDependents = useInvalidateAttributeTypeDependents();
    return trpc.attributeTypes.move.useMutation(mutationOptions({ invalidate: invalidateDependents }));
}

export function useDeleteAttributeType() {
    const utils = trpc.useUtils();
    const invalidateDependents = useInvalidateAttributeTypeDependents();
    return trpc.attributeTypes.delete.useMutation(
        mutationOptions({
            invalidate: () => {
                invalidateDependents();
                void utils.productAttributes.list.invalidate();
            },
            success: 'Тип удалён',
        }),
    );
}

export function useProductAttributeList(typeId?: number) {
    return trpc.productAttributes.list.useQuery({ typeId });
}

export function useCreateProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.create.useMutation(
        mutationOptions({
            invalidate: () => void utils.productAttributes.list.invalidate(),
            success: 'Значение добавлено',
        }),
    );
}

export function useUpdateProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.update.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.productAttributes.list.invalidate();
                void utils.products.list.invalidate();
                void utils.products.getById.invalidate();
                void utils.purchases.list.invalidate();
                void utils.purchases.getById.invalidate();
            },
            success: 'Значение обновлено',
        }),
    );
}

export function useDeleteProductAttribute() {
    const utils = trpc.useUtils();
    return trpc.productAttributes.delete.useMutation(
        mutationOptions({
            invalidate: () => void utils.productAttributes.list.invalidate(),
            success: 'Значение удалено',
        }),
    );
}
