'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/client/trpc';
import { displayName } from '@/lib/utils/user';
import { paymentTotal } from '../../lib/utils';

const emptyMaps = () => ({
    userIds: [] as number[],
    userMap: new Map<number, { name: string; username?: string }>(),
    userOrders: new Map<number, never[]>(),
    userPayments: new Map<number, never[]>(),
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
        orders.forEach((o) => {
        if (
            !userMap.has(o.userId) &&
            (o as { user?: { firstName: string; lastName?: string | null; username?: string } }).user
        ) {
            const u = (o as { user: { firstName: string; lastName?: string | null; username?: string } }).user;
            userMap.set(o.userId, {
                name: displayName({ firstName: u.firstName, lastName: u.lastName ?? null }),
                username: u.username,
            });
            }
        });

        const userOrders = new Map<number, (typeof orders)[number][]>();
        orders.forEach((o) => {
            if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
            userOrders.get(o.userId)!.push(o);
        });

        const userPayments = new Map<number, NonNullable<typeof payments>>();
        payments?.forEach((p) => {
            if (!userPayments.has(p.userId)) userPayments.set(p.userId, []);
            userPayments.get(p.userId)!.push(p);
        });

        const paidByUser = new Map<number, number>();
        const pendingByUser = new Map<number, number>();
        payments?.forEach((p) => {
            const status = (p as { status: string }).status;
            const total = paymentTotal(p as { amount: unknown; children?: { amount: unknown }[] });
            if (status === 'CONFIRMED') {
                paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + total);
            }
            if (status === 'PENDING') {
                pendingByUser.set(p.userId, (pendingByUser.get(p.userId) ?? 0) + total);
            }
        });

        const totalDue = orders.reduce((sum, o) => sum + Number(o.amountDue), 0);
        const totalPaid =
            payments?.reduce(
                (sum, p) => sum + paymentTotal(p as { amount: unknown; children?: { amount: unknown }[] }),
                0,
            ) ?? 0;
        const totalPending =
            payments
                ?.filter((p) => (p as { status: string }).status === 'PENDING')
                .reduce(
                    (sum, p) => sum + paymentTotal(p as { amount: unknown; children?: { amount: unknown }[] }),
                    0,
                ) ?? 0;

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
        payments,
        ...participantData,
    };
}
