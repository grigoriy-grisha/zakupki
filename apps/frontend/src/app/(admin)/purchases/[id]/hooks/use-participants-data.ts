'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/client/trpc';
import { displayName } from '@/lib/utils/user';
import { safeNumber } from '@/lib/utils';
import { paymentTotal } from '../../lib/utils';
import type { PaymentRef, UserBrief, PurchaseItem, OrderLineRef } from '../lib/types';

/** PurchaseOrder в том виде, как его отдаёт orders.getAllByPurchase (см. order.repository.getByPurchase). */
export interface OrderComment {
    id: number;
    comment: string | null;
    commentAuthor: number | null;
    commentAt: string | null;
}

type OrderRow = OrderLineRef & {
    purchaseOrder?: OrderComment | null;
    user?: UserBrief;
};

const emptyMaps = () => ({
    userIds: [] as number[],
    userMap: new Map<number, { name: string; username?: string }>(),
    userOrders: new Map<number, OrderRow[]>(),
    userPayments: new Map<number, PaymentRef[]>(),
    paidByUser: new Map<number, number>(),
    pendingByUser: new Map<number, number>(),
    // Денормализованная карта «участник → комментарий» — comment привязан
    // к PurchaseOrder, а не к OrderLine, поэтому одна запись на userId.
    orderComments: new Map<number, OrderComment>(),
    totalDue: 0,
    totalPaid: 0,
    totalPending: 0,
});

export function useParticipantsData(purchaseId: number) {
    const { data: orders, isLoading: ordersLoading } = trpc.orders.getAllByPurchase.useQuery({ purchaseId });
    const { data: payments, isLoading: paymentsLoading } = trpc.payments.getByPurchase.useQuery({ purchaseId });

    const isLoading = ordersLoading || paymentsLoading;

    const aggregated = useMemo(() => {
        if (!orders?.length) {
            return { isEmpty: true as const, ...emptyMaps() };
        }

        const typedOrders = (orders as unknown as OrderRow[]);
        const typedPayments = (payments ?? []) as unknown as PaymentRef[];

        const userMap = new Map<number, { name: string; username?: string }>();
        const userOrders = new Map<number, OrderRow[]>();
        const orderComments = new Map<number, OrderComment>();

        typedOrders.forEach((o) => {
            if (!userMap.has(o.userId) && o.user) {
                userMap.set(o.userId, {
                    name: displayName({ firstName: o.user.firstName, lastName: o.user.lastName ?? null }),
                    username: o.user.username,
                });
            }
            if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
            userOrders.get(o.userId)!.push(o);
            // Берём первое вхождение purchaseOrder для userId (инвариант домена:
            // все order lines одного пользователя в одной закупке принадлежат
            // одному PurchaseOrder).
            if (o.purchaseOrder && !orderComments.has(o.userId)) {
                orderComments.set(o.userId, o.purchaseOrder);
            }
        });

        const userPayments = new Map<number, PaymentRef[]>();
        typedPayments.forEach((p) => {
            if (!userPayments.has(p.userId)) userPayments.set(p.userId, []);
            userPayments.get(p.userId)!.push(p);
        });

        const paidByUser = new Map<number, number>();
        const pendingByUser = new Map<number, number>();
        typedPayments.forEach((p) => {
            const total = paymentTotal(p);
            if (p.status === 'CONFIRMED') {
                paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + total);
            }
            if (p.status === 'PENDING') {
                pendingByUser.set(p.userId, (pendingByUser.get(p.userId) ?? 0) + total);
            }
        });

        const totalDue = typedOrders.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
        const totalPaid = typedPayments.reduce((sum, p) => sum + paymentTotal(p), 0);
        const totalPending = typedPayments
            .filter((p) => p.status === 'PENDING')
            .reduce((sum, p) => sum + paymentTotal(p), 0);

        const userIds = Array.from(userOrders.keys());

        return {
            isEmpty: false as const,
            userIds,
            userMap,
            userOrders,
            userPayments,
            paidByUser,
            pendingByUser,
            orderComments,
            totalDue,
            totalPaid,
            totalPending,
        };
    }, [orders, payments]);

    const { isEmpty: aggregatedEmpty, ...participantData } = aggregated;

    return {
        isLoading,
        isEmpty: !isLoading && aggregatedEmpty,
        payments: (payments ?? []) as unknown as PaymentRef[],
        ...participantData,
    };
}
