import { toast } from 'sonner';

interface MutationOptionsConfig<TData, TVariables> {
    invalidate?: (variables: TVariables) => void;
    success?: string | ((data: TData, variables: TVariables) => string);
    /**
     * Non-null → toast.warning вместо success-тоста: операция прошла,
     * но с оговоркой (например, пост в канале удалить не удалось).
     */
    warning?: (data: TData, variables: TVariables) => string | null;
}

export function mutationOptions<TData = unknown, TVariables = unknown>({
    invalidate,
    success,
    warning,
}: MutationOptionsConfig<TData, TVariables>) {
    return {
        onSuccess: (data: TData, variables: TVariables) => {
            invalidate?.(variables);
            const warningText = warning?.(data, variables) ?? null;
            if (warningText) {
                toast.warning(warningText);
                return;
            }
            if (success !== undefined) {
                toast.success(typeof success === 'function' ? success(data, variables) : success);
            }
        },
        onError: (err: { message: string }) => toast.error(err.message),
    };
}
