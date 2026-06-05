import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '../../../lib/use-crud-mutation';

export function usePostTemplateList() {
    return trpc.postTemplates.list.useQuery();
}

export function useCreatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.create.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['postTemplates', 'list']], 'Шаблон создан'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useUpdatePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.update.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['postTemplates', 'list']], 'Шаблон сохранён'),
        onError: (err) => { toast.error(err.message); },
    });
}

export function useDeletePostTemplate() {
    const utils = trpc.useUtils();
    return trpc.postTemplates.delete.useMutation({
        onSuccess: () => invalidateAndToast(utils, [['postTemplates', 'list']], 'Шаблон удалён'),
        onError: (err) => { toast.error(err.message); },
    });
}
