'use client';

import { useMemo } from 'react';
import type { HandoffStatus } from '@zakupki/types';
import { trpc } from '@/lib/client/trpc';
import { displayName } from '@/lib/utils/user';
import { safeNumber } from '@/lib/utils';
import { paymentTotal } from '../../lib/utils';
import type { ParticipantOrderItem } from '../components/participants/types';
import type { PaymentRef, UserBrief, OrderLineRef } from '../lib/types';

/** PurchaseOrder в том виде, как его отдаёт orders.getAllByPurchase (см. order.repository.getByPurchase). */
export interface OrderComment {
    id: number;
    comment: string | null;
    commentAuthor: number | null;
    commentAt: string | null;
    handoffStatus?: HandoffStatus | null;
}

type OrderRow = OrderLineRef & {
    purchaseOrder?: OrderComment | null;
    user?: UserBrief;
    purchaseItem?: ParticipantOrderItem;
};

/**
 * Запись из orders.getPurchaseOrdersByPurchase (см. order.repository.findPurchaseOrdersByPurchase).
 * Источник правды для списка участников — покрывает и «голых» участников без строк.
 */
interface PurchaseOrderRow {
    id: number;
    userId: number;
    comment: string | null;
    commentAuthor: number | null;
    commentAt: string | null;
    handoffStatus: HandoffStatus | null;
    user: {
        firstName: string;
        lastName: string | null;
        username: string | null;
        avatarUrl: string | null;
        telegramCredential: { username: string | null } | null;
    } | null;
}

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
    handoffByUser: new Map<number, HandoffStatus | null>(),
    totalDue: 0,
    totalPaid: 0,
    totalPending: 0,
});

export function useParticipantsData(purchaseId: number) {
    const { data: orders, isLoading: ordersLoading } = trpc.orders.getAllByPurchase.useQuery({ purchaseId });
    const { data: purchaseOrders, isLoading: poLoading } =
        trpc.orders.getPurchaseOrdersByPurchase.useQuery({ purchaseId });
    const { data: payments, isLoading: paymentsLoading } = trpc.payments.getByPurchase.useQuery({ purchaseId });

    const isLoading = ordersLoading || paymentsLoading || poLoading;

    const aggregated = useMemo(() => {
        const typedOrders = (orders ?? []) as unknown as OrderRow[];
        const typedPurchaseOrders = (purchaseOrders ?? []) as unknown as PurchaseOrderRow[];
        const typedPayments = (payments ?? []) as unknown as PaymentRef[];

        const userMap = new Map<number, { name: string; username?: string }>();
        const userOrders = new Map<number, OrderRow[]>();
        const orderComments = new Map<number, OrderComment>();
        const handoffByUser = new Map<number, HandoffStatus | null>();

        // 1) PurchaseOrder — источник правды участников (включает «голых»).
        //    Сначала заполняем userMap и orderComments из заголовков.
        for (const po of typedPurchaseOrders) {
            if (po.user) {
                // username приоритетно из telegramCredential, затем из user.username.
                const uname = po.user.telegramCredential?.username ?? po.user.username ?? undefined;
                if (!userMap.has(po.userId)) {
                    userMap.set(po.userId, {
                        name: displayName({
                            firstName: po.user.firstName,
                            lastName: po.user.lastName ?? null,
                        }),
                        username: uname,
                    });
                }
            }
            if (!orderComments.has(po.userId)) {
                orderComments.set(po.userId, {
                    id: po.id,
                    comment: po.comment,
                    commentAuthor: po.commentAuthor,
                    commentAt: po.commentAt,
                    handoffStatus: po.handoffStatus,
                });
            }
            if (!handoffByUser.has(po.userId)) {
                handoffByUser.set(po.userId, po.handoffStatus);
            }
        }

        // 2) OrderLine — заказы (россыпь/упаковки) и дополнение userMap.
        typedOrders.forEach((o) => {
            if (!userMap.has(o.userId) && o.user) {
                userMap.set(o.userId, {
                    name: displayName({ firstName: o.user.firstName, lastName: o.user.lastName ?? null }),
                    username: o.user.username,
                });
            }
            if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
            userOrders.get(o.userId)!.push(o);
            // Запасной путь: если PurchaseOrder-запрос ещё не вернулся/пуст,
            // берём purchaseOrder из строки (инвариант: одна запись на userId).
            if (o.purchaseOrder && !orderComments.has(o.userId)) {
                orderComments.set(o.userId, o.purchaseOrder);
            }
            if (o.purchaseOrder && !handoffByUser.has(o.userId)) {
                handoffByUser.set(o.userId, o.purchaseOrder.handoffStatus ?? null);
            }
        });

        // userIds — объединение из PurchaseOrder (вес участников) и строк.
        const userIdSet = new Set<number>(typedPurchaseOrders.map((po) => po.userId));
        userOrders.forEach((_v, uid) => userIdSet.add(uid));
        const userIds = Array.from(userIdSet);

        // Пусто только если вообще нет ни PurchaseOrder, ни строк.
        if (userIds.length === 0) {
            return { isEmpty: true as const, ...emptyMaps() };
        }

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
        // «Покрыто» — только подтверждённые платежи (CONFIRMED), в согласовании с
        // paidByUser, который питает бейдж «Оплачено». Раньше здесь не было фильтра
        // по статусу, поэтому PENDING/REJECTED платежи завышали «Покрыто» — особенно
        // заметно с промокодом: paymentTotal восстанавливает полную сумму (родитель +
        // дочерний промокод-платёж), и «Покрыто» приравнивалось к «К оплате» сразу
        // при отправке, хотя платёж ещё не подтверждён (бейдж при этом верно показывал
        // «Не оплачено»/«Ждёт»).
        const totalPaid = typedPayments
            .filter((p) => p.status === 'CONFIRMED')
            .reduce((sum, p) => sum + paymentTotal(p), 0);
        const totalPending = typedPayments
            .filter((p) => p.status === 'PENDING')
            .reduce((sum, p) => sum + paymentTotal(p), 0);

        return {
            isEmpty: false as const,
            userIds,
            userMap,
            userOrders,
            userPayments,
            paidByUser,
            pendingByUser,
            orderComments,
            handoffByUser,
            totalDue,
            totalPaid,
            totalPending,
        };
    }, [orders, purchaseOrders, payments]);

    const { isEmpty: aggregatedEmpty, ...participantData } = aggregated;

    return {
        isLoading,
        isEmpty: !isLoading && aggregatedEmpty,
        payments: (payments ?? []) as unknown as PaymentRef[],
        ...participantData,
    };
}
