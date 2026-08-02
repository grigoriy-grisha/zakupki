import { createCrudHooks } from '../../shared/create-crud-hooks';
import { trpc } from '@/lib/client/trpc';
import { currencyMessages } from '../config';

const hooks = createCrudHooks({
    router: trpc.currencies,
    queryKeys: [['currencies', 'list']],
    messages: currencyMessages,
});

export const useCurrencyList = hooks.useList;
export const useCreateCurrency = hooks.useCreate;
export const useUpdateCurrency = hooks.useUpdate;
export const useDeleteCurrency = hooks.useDelete;
