import { createCrudHooks } from '../../shared/create-crud-hooks';
import { trpc } from '@/lib/client/trpc';
import { supplierMessages } from '../config';

const hooks = createCrudHooks({
    router: trpc.suppliers,
    queryKeys: [['suppliers', 'list']],
    messages: supplierMessages,
});

export const useSupplierList = hooks.useList;
export const useCreateSupplier = hooks.useCreate;
export const useUpdateSupplier = hooks.useUpdate;
export const useDeleteSupplier = hooks.useDelete;
