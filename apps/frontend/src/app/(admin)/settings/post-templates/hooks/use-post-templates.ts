import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function usePostTemplateList() {
    return trpc.postTemplates.list.useQuery();
}

export function useCreatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.create.useMutation({
        onSuccess: async () => {
            await utils.postTemplates.list.invalidate();
            toast.success('Шаблон создан');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useUpdatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.update.useMutation({
        onSuccess: async () => {
            await utils.postTemplates.list.invalidate();
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeletePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.delete.useMutation({
        onSuccess: async () => {
            await utils.postTemplates.list.invalidate();
            toast.success('Шаблон удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}
