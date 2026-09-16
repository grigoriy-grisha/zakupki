import { toast } from 'sonner';

interface MutationOptionsConfig<TData, TVariables> {
    invalidate?: (variables: TVariables) => void;
    success?: string | ((data: TData, variables: TVariables) => string);
}

export function mutationOptions<TData = unknown, TVariables = unknown>({
    invalidate,
    success,
}: MutationOptionsConfig<TData, TVariables>) {
    return {
        onSuccess: (data: TData, variables: TVariables) => {
            invalidate?.(variables);
            if (success !== undefined) {
                toast.success(typeof success === 'function' ? success(data, variables) : success);
            }
        },
        onError: (err: { message: string }) => toast.error(err.message),
    };
}
