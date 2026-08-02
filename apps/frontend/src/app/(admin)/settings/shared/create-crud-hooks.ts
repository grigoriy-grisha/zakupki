import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { invalidateAndToast } from '@/app/(admin)/lib/use-crud-mutation';

/**
 * Конфигурация для фабрики CRUD хуков.
 */
export interface CrudHookConfig {
    /** tRPC роутер с методами list, create, update, delete */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    /** Ключи для инвалидации после мутаций */
    queryKeys: [string, string][];
    /** Сообщения об успехе */
    messages: {
        createSuccess: string;
        updateSuccess: string;
        deleteSuccess: string;
    };
    /** Дополнительные ключи для инвалидации при удалении */
    extraDeleteInvalidateKeys?: [string, string][];
}

/**
 * Фабрика для создания стандартных CRUD хуков.
 * Устраняет дублирование паттерна list/create/update/delete hooks.
 *
 * @example
 * ```ts
 * const hooks = createCrudHooks({
 *     router: trpc.characteristics,
 *     queryKeys: [['characteristics', 'list']],
 *     messages: {
 *         createSuccess: 'Характеристика создана',
 *         updateSuccess: 'Характеристика обновлена',
 *         deleteSuccess: 'Характеристика удалена',
 *     },
 * });
 * export const useCharacteristicList = hooks.useList;
 * ```
 */
export function createCrudHooks(config: CrudHookConfig) {
    const { router, queryKeys, messages, extraDeleteInvalidateKeys } = config;

    function useList() {
        return router.list.useQuery();
    }

    function useCreate() {
        const utils = trpc.useUtils();
        return router.create.useMutation({
            onSuccess: () => {
                invalidateAndToast(utils, queryKeys, messages.createSuccess);
            },
            onError: (err: { message: string }) => {
                toast.error(err.message);
            },
        });
    }

    function useUpdate() {
        const utils = trpc.useUtils();
        return router.update.useMutation({
            onSuccess: () => {
                invalidateAndToast(utils, queryKeys, messages.updateSuccess);
            },
            onError: (err: { message: string }) => {
                toast.error(err.message);
            },
        });
    }

    function useDelete() {
        const utils = trpc.useUtils();
        const deleteKeys: [string, string][] = extraDeleteInvalidateKeys
            ? [...queryKeys, ...extraDeleteInvalidateKeys]
            : queryKeys;

        return router.delete.useMutation({
            onSuccess: () => {
                invalidateAndToast(utils, deleteKeys, messages.deleteSuccess);
            },
            onError: (err: { message: string }) => {
                toast.error(err.message);
            },
        });
    }

    return {
        useList,
        useCreate,
        useUpdate,
        useDelete,
    };
}
