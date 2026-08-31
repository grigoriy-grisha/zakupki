import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

function postTemplateMutationOptions(utils: ReturnType<typeof trpc.useUtils>, successMessage: string) {
    return {
        onSuccess: () => invalidateAndToast(utils, [['postTemplates', 'list']], successMessage),
        onError: (err: { message: string }) => {
            toast.error(err.message);
        },
    };
}

export function usePostTemplateList() {
    return trpc.postTemplates.list.useQuery();
}

export function useCreatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.create.useMutation(postTemplateMutationOptions(utils, 'Шаблон создан'));
}

export function useUpdatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.update.useMutation(postTemplateMutationOptions(utils, 'Шаблон сохранён'));
}

export function useDeletePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.delete.useMutation(postTemplateMutationOptions(utils, 'Шаблон удалён'));
}
