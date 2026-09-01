import { paymentTotal } from '@/lib/payment-utils';

import { formatMoney } from './excel-basics';
import type { ExportOrder, ExportParticipant, ExportPayment, ExportUser } from './types';

export function userName(user?: ExportUser) {
    if (!user) return '';
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

export function extractParticipantCredentials(user?: ExportUser) {
    const tgUsername = (user?.telegramCredential?.username ?? user?.username ?? '').replace(/^@/, '');
    return {
        tgUsername,
        telegramId: user?.telegramCredential?.telegramId ?? '',
        vkId: user?.vkCredential?.vkId ?? '',
    };
}

export function buildParticipants(orders: ExportOrder[]): ExportParticipant[] {
    const map = new Map<number, ExportParticipant>();

    orders.forEach((order) => {
        if (map.has(order.userId)) return;
        map.set(order.userId, {
            userId: order.userId,
            purchaseOrderId: order.purchaseOrderId ?? null,
            name: userName(order.user) || `Участник #${order.userId}`,
            phone: order.user?.phone?.trim() ?? '',
            ...extractParticipantCredentials(order.user),
        });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function participantStatus(due: number, paid: number, pending: number) {
    if (paid >= due) return 'Оплачено';
    if (pending > 0) return 'Ожидает подтверждения';
    if (paid > 0) return 'Частично оплачено';
    return 'Не оплачено';
}

export function buildParticipantSummary(orders: ExportOrder[], payments: ExportPayment[]) {
    const userOrders = new Map<number, ExportOrder[]>();
    orders.forEach((order) => {
        const list = userOrders.get(order.userId) ?? [];
        list.push(order);
        userOrders.set(order.userId, list);
    });

    const paidByUser = new Map<number, number>();
    const pendingByUser = new Map<number, number>();
    payments.forEach((payment) => {
        const total = paymentTotal(payment);
        if (payment.status === 'CONFIRMED') {
            paidByUser.set(payment.userId, (paidByUser.get(payment.userId) ?? 0) + total);
        }
        if (payment.status === 'PENDING') {
            pendingByUser.set(payment.userId, (pendingByUser.get(payment.userId) ?? 0) + total);
        }
    });

    return Array.from(userOrders.entries()).map(([userId, userOrdersList]) => {
        const due = userOrdersList.reduce((sum, order) => sum + formatMoney(order.amountDue), 0);
        const paid = paidByUser.get(userId) ?? 0;
        const pending = pendingByUser.get(userId) ?? 0;
        const user = userOrdersList.find((order) => order.user)?.user;

        return {
            userId,
            name: userName(user) || `Участник #${userId}`,
            ...extractParticipantCredentials(user),
            positions: userOrdersList.length,
            due,
            paid,
            pending,
            status: participantStatus(due, paid, pending),
        };
    });
}

export function groupOrdersByUser(orders: ExportOrder[]) {
    const map = new Map<number, ExportOrder[]>();
    orders.forEach((order) => {
        const list = map.get(order.userId) ?? [];
        list.push(order);
        map.set(order.userId, list);
    });
    return map;
}
