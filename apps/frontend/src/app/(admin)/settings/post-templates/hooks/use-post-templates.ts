import { trpc } from '@/lib/client/trpc';

import { createCrudHooks } from '../../shared/create-crud-hooks';

const hooks = createCrudHooks({
    router: trpc.postTemplates,
    queryKeys: [['postTemplates', 'list']],
    messages: {
        createSuccess: 'Шаблон создан',
        updateSuccess: 'Шаблон сохранён',
        deleteSuccess: 'Шаблон удалён',
    },
});

export const usePostTemplateList = hooks.useList;
export const useCreatePostTemplate = hooks.useCreate;
export const useUpdatePostTemplate = hooks.useUpdate;
export const useDeletePostTemplate = hooks.useDelete;
