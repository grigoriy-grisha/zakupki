'use client';

import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';

/**
 * Мутации ручного управления позициями участника (admin override).
 * Действия идут в обход stage-правил/пула/лимита поставщика —
 * серверный OrderService.admin* делегирует в OrderBook.admin*.
 *
 * После каждого успеха инвалидируем orders.getAllByPurchase (карточки
 * участников, суммы due/paid/pending) и purchases.getById (статистика
 * закупки, остатки в items-вкладке).
 */
export function useParticipantOrderActions(purchaseId: number) {
    const utils = trpc.useUtils();

    const invalidate = () => {
        void utils.orders.getAllByPurchase.invalidate({ purchaseId });
        void utils.purchases.getById.invalidate({ id: purchaseId });
    };

    const adminAdjust = trpc.orders.adminAdjust.useMutation({
        onSuccess: () => {
            invalidate();
            toast.success('Количество обновлено');
        },
        onError: (err) => toast.error(err.message),
    });

    const adminSetQuantity = trpc.orders.adminSetQuantity.useMutation({
        onSuccess: () => {
            invalidate();
            toast.success('Количество обновлено');
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteOrderLine = trpc.orders.deleteOrder.useMutation({
        onSuccess: () => {
            invalidate();
            toast.success('Позиция удалена');
        },
        onError: (err) => toast.error(err.message),
    });

    const removeParticipant = trpc.orders.removeAllByUserFromPurchase.useMutation({
        onSuccess: (result) => {
            invalidate();
            toast.success(`Удалено заказов: ${result.count}`);
        },
        onError: (err) => toast.error(err.message),
    });

    const setOrderComment = trpc.purchases.setOrderComment.useMutation({
        onSuccess: () => {
            invalidate();
            toast.success('Комментарий сохранён');
        },
        onError: (err) => toast.error(err.message),
    });

    return { adminAdjust, adminSetQuantity, deleteOrderLine, removeParticipant, setOrderComment };
}
