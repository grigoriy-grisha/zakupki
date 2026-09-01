import { trpc } from '@/lib/client/trpc';

import { createCrudHooks } from '../../shared/create-crud-hooks';

const hooks = createCrudHooks({
    router: trpc.promoCodes,
    queryKeys: [['promoCodes', 'list']],
    messages: {
        createSuccess: 'Промокод создан',
        updateSuccess: 'Статус обновлён',
        deleteSuccess: 'Промокод удалён',
    },
});

export const usePromoCodesList = hooks.useList;
export const useCreatePromoCode = hooks.useCreate;
export const useTogglePromoCode = hooks.useUpdate;
export const useDeletePromoCode = hooks.useDelete;
