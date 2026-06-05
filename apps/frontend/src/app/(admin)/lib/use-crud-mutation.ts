import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

/**
 * Инвалидирует query-процедуры через tRPC utils и показывает toast.
 * Используется в onSuccess мутаций.
 *
 * @example
 * ```ts
 * export function useCreateUnit() {
 *     const utils = trpc.useUtils();
 *     return trpc.units.create.useMutation({
 *         onSuccess: () => { invalidateAndToast(utils, [['units', 'list']], 'Единица создана'); },
 *         onError: (err) => { toast.error(err.message); },
 *     });
 * }
 * ```
 */
export function invalidateAndToast(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    utils: any,
    keys: [router: string, procedure: string][],
    successMsg: string,
) {
    for (const [router, procedure] of keys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void utils[router][procedure].invalidate();
    }
    toast.success(successMsg);
}
