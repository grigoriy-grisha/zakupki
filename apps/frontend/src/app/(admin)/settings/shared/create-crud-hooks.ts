import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export interface CrudHookConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    queryKeys: [string, string][];
    messages: {
        createSuccess: string;
        updateSuccess: string;
        deleteSuccess: string;
    };
    extraDeleteInvalidateKeys?: [string, string][];
}

export function createCrudHooks(config: CrudHookConfig) {
    const { router, queryKeys, messages, extraDeleteInvalidateKeys } = config;

    function useList() {
        return router.list.useQuery();
    }

    function useCreate() {
        const utils = trpc.useUtils();
        return router.create.useMutation(
            mutationOptions({
                invalidate: () => void invalidateKeys(utils, queryKeys),
                success: messages.createSuccess,
            }),
        );
    }

    function useUpdate() {
        const utils = trpc.useUtils();
        return router.update.useMutation(
            mutationOptions({
                invalidate: () => void invalidateKeys(utils, queryKeys),
                success: messages.updateSuccess,
            }),
        );
    }

    function useDelete() {
        const utils = trpc.useUtils();
        const deleteKeys: [string, string][] = extraDeleteInvalidateKeys
            ? [...queryKeys, ...extraDeleteInvalidateKeys]
            : queryKeys;
        return router.delete.useMutation(
            mutationOptions({
                invalidate: () => void invalidateKeys(utils, deleteKeys),
                success: messages.deleteSuccess,
            }),
        );
    }

    return {
        useList,
        useCreate,
        useUpdate,
        useDelete,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invalidateKeys(utils: any, keys: [string, string][]) {
    for (const [router, procedure] of keys) {
        void utils[router][procedure].invalidate();
    }
}
