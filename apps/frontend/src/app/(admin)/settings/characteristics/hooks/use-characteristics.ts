import { trpc } from '@/lib/client/trpc';

import { createCrudHooks } from '../../shared/create-crud-hooks';
import { characteristicMessages } from '../config';

const hooks = createCrudHooks({
    router: trpc.characteristics,
    queryKeys: [['characteristics', 'list']],
    messages: characteristicMessages,
    extraDeleteInvalidateKeys: [['attributeTypes', 'list']],
});

export const useCharacteristicList = hooks.useList;
export const useCreateCharacteristic = hooks.useCreate;
export const useUpdateCharacteristic = hooks.useUpdate;
export const useDeleteCharacteristic = hooks.useDelete;
