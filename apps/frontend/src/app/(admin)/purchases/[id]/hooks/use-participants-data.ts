'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/client/trpc';
import { displayName } from '@/lib/utils/user';
import { paymentTotal } from '../../lib/utils';
import type { PaymentRef, UserBrief, PurchaseItem, OrderLineRef } from '../lib/types';

type OrderRow = {
    userId: number;
    amountDue: unknown;
    purchaseOrderId?: number | null;
    user?: UserBrief;
};

const emptyMaps = () => ({
    userIds: [] as number[],
    userMap: new Map<number, { name: string; username?: string }>(),
    userOrders: new Map<number, unknown[]>(),
    userPayments: new Map<number, unknown[]>(),
    paidByUser: new Map<number, number>(),
    pendingByUser: new Map<number, number>(),
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

        const userMap = new Map<number, { name: string; username?: string }>();
        (orders as OrderRow[]).forEach((o) => {
            if (!userMap.has(o.userId) && o.user) {
                userMap.set(o.userId, {
                    name: displayName({ firstName: o.user.firstName, lastName: o.user.lastName ?? null }),
                    username: o.user.username,
                });
            }
        });

        const userOrders = new Map<number, OrderRow[]>();
        (orders as OrderRow[]).forEach((o) => {
            if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
            userOrders.get(o.userId)!.push(o);
        });

        const typedPayments = (payments ?? []) as unknown as PaymentRef[];
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

        const totalDue = (orders as OrderRow[]).reduce((sum, o) => sum + Number(o.amountDue), 0);
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
