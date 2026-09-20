'use client';

import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useParticipantOrderActions(purchaseId: number) {
    const utils = trpc.useUtils();

    /**
     * Точечное обновление после мутации: дотягиваем с бэка только строки этого
     * участника и латаем кэши локально. Тяжёлые запросы (вся закупка, заголовки)
     * помечаются устаревшими без немедленного рефетча — подхватятся при переходе
     * на соответствующую вкладку.
     */
    const refreshUserLines = async (userId: number) => {
        const fresh = await utils.orders.getLinesByUserAndPurchase.fetch({ purchaseId, userId });

        utils.orders.getAllByPurchase.setData({ purchaseId }, (old) => {
            if (!old) return old;
            return [...old.filter((row) => row.userId !== userId), ...(fresh as unknown as typeof old)];
        });

        const detail = utils.purchases.getById.getData({ id: purchaseId });
        if (detail) {
            utils.purchases.getById.setData({ id: purchaseId }, {
                ...detail,
                items: detail.items.map((item) => ({
                    ...item,
                    orderLines: [
                        ...item.orderLines.filter((l) => l.userId !== userId),
                        ...(fresh as unknown as typeof item.orderLines).filter(
                            (l) => l.purchaseItemId === item.id,
                        ),
                    ],
                })),
            });
        }

        void utils.orders.getPurchaseOrdersByPurchase.invalidate(
            { purchaseId },
            { refetchType: 'none' },
        );
        void utils.purchases.getById.invalidate({ id: purchaseId }, { refetchType: 'none' });
    };

    const refreshAllLines = () => {
        void utils.orders.getAllByPurchase.invalidate({ purchaseId });
        void utils.orders.getPurchaseOrdersByPurchase.invalidate({ purchaseId });
        void utils.purchases.getById.invalidate({ id: purchaseId }, { refetchType: 'none' });
    };

    const adminAdjust = trpc.orders.adminAdjust.useMutation(
        mutationOptions({
            invalidate: (v) => void refreshUserLines(v.userId),
            success: 'Количество обновлено',
        }),
    );

    const adminSetQuantity = trpc.orders.adminSetQuantity.useMutation(
        mutationOptions({
            invalidate: (v) => void refreshUserLines(v.userId),
            success: 'Количество обновлено',
        }),
    );

    const adminAdjustPackage = trpc.orders.adminAdjustPackageCount.useMutation(
        mutationOptions({
            invalidate: (v) => void refreshUserLines(v.userId),
            success: 'Упаковки обновлены',
        }),
    );

    const deleteOrderLine = trpc.orders.deleteOrder.useMutation(
        mutationOptions({
            invalidate: refreshAllLines,
            success: 'Позиция удалена',
        }),
    );

    const deleteLineForUser = async (input: { id: number; userId: number }) => {
        await deleteOrderLine.mutateAsync(input);
        await refreshUserLines(input.userId);
    };

    const removeParticipant = trpc.orders.removeAllByUserFromPurchase.useMutation(
        mutationOptions({
            invalidate: refreshAllLines,
            success: (result) => `Удалено заказов: ${result.count}`,
        }),
    );

    const deleteAllByUserItem = trpc.orders.deleteAllByUserItem.useMutation(
        mutationOptions({
            invalidate: (v) => void refreshUserLines(v.userId),
            success: 'Товар удалён',
        }),
    );

    // Комментарий и статус выдачи живут в PurchaseOrder-заголовках — лёгкий рефетч.
    const refreshOrderHeaders = () => {
        void utils.orders.getPurchaseOrdersByPurchase.invalidate({ purchaseId });
    };

    const setOrderComment = trpc.purchases.setOrderComment.useMutation(
        mutationOptions({ invalidate: refreshOrderHeaders, success: 'Комментарий сохранён' }),
    );

    const addParticipant = trpc.orders.addParticipant.useMutation(
        mutationOptions({ invalidate: refreshOrderHeaders, success: 'Участник добавлен' }),
    );

    const setHandoffStatus = trpc.orders.setHandoffStatus.useMutation(
        mutationOptions({ invalidate: refreshOrderHeaders, success: 'Статус выдачи обновлён' }),
    );

    return {
        adminAdjust,
        adminSetQuantity,
        adminAdjustPackage,
        deleteOrderLine,
        deleteLineForUser,
        removeParticipant,
        deleteAllByUserItem,
        setOrderComment,
        addParticipant,
        setHandoffStatus,
    };
}
