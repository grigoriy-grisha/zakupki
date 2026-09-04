import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useHandoffChoice() {
    const utils = trpc.useUtils();
    return trpc.orders.setHandoffChoice.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.orders.getMyOrders.invalidate();
            },
            success: 'Спасибо, ответ принят',
        }),
    );
}
