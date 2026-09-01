'use client';

import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useParticipantOrderActions(purchaseId: number) {
    const utils = trpc.useUtils();

    const invalidate = () => {
        void utils.orders.getAllByPurchase.invalidate({ purchaseId });
        void utils.orders.getPurchaseOrdersByPurchase.invalidate({ purchaseId });
        void utils.purchases.getById.invalidate({ id: purchaseId });
    };

    const adminAdjust = trpc.orders.adminAdjust.useMutation(
        mutationOptions({ invalidate, success: 'Количество обновлено' }),
    );

    const adminSetQuantity = trpc.orders.adminSetQuantity.useMutation(
        mutationOptions({ invalidate, success: 'Количество обновлено' }),
    );

    const adminAdjustPackage = trpc.orders.adminAdjustPackageCount.useMutation(
        mutationOptions({ invalidate, success: 'Упаковки обновлены' }),
    );

    const deleteOrderLine = trpc.orders.deleteOrder.useMutation(
        mutationOptions({ invalidate, success: 'Позиция удалена' }),
    );

    const removeParticipant = trpc.orders.removeAllByUserFromPurchase.useMutation(
        mutationOptions({ invalidate, success: (result) => `Удалено заказов: ${result.count}` }),
    );

    const deleteAllByUserItem = trpc.orders.deleteAllByUserItem.useMutation(
        mutationOptions({ invalidate, success: 'Товар удалён' }),
    );

    const setOrderComment = trpc.purchases.setOrderComment.useMutation(
        mutationOptions({ invalidate, success: 'Комментарий сохранён' }),
    );

    const addParticipant = trpc.orders.addParticipant.useMutation(
        mutationOptions({ invalidate, success: 'Участник добавлен' }),
    );

    const setHandoffStatus = trpc.orders.setHandoffStatus.useMutation(
        mutationOptions({ invalidate, success: 'Статус выдачи обновлён' }),
    );

    return {
        adminAdjust,
        adminSetQuantity,
        adminAdjustPackage,
        deleteOrderLine,
        removeParticipant,
        deleteAllByUserItem,
        setOrderComment,
        addParticipant,
        setHandoffStatus,
    };
}
