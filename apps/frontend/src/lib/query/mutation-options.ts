import { toast } from 'sonner';

interface MutationOptionsConfig<TData> {
    invalidate?: () => void;
    success?: string | ((data: TData) => string);
}

export function mutationOptions<TData = unknown>({ invalidate, success }: MutationOptionsConfig<TData>) {
    return {
        onSuccess: (data: TData) => {
            invalidate?.();
            if (success !== undefined) {
                toast.success(typeof success === 'function' ? success(data) : success);
            }
        },
        onError: (err: { message: string }) => toast.error(err.message),
    };
}
