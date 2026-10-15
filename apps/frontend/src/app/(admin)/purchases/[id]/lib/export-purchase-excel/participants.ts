import { paymentTotal } from '@/lib/payment-utils';

import { getPaymentStatus, type PaymentStatus } from '../../../lib/payment-status';
import { roundMoney, toNumber } from './pricing-cells';
import type {
    ExportOrder,
    ExportParticipant,
    ExportPayment,
    ExportPurchaseOrder,
    ExportUser,
} from './types';

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

function participantFromUser(
    userId: number,
    purchaseOrderId: number | null,
    user?: ExportUser,
): ExportParticipant {
    return {
        userId,
        purchaseOrderId,
        name: userName(user) || `Участник #${userId}`,
        phone: user?.phone?.trim() ?? '',
        ...extractParticipantCredentials(user),
    };
}

export function buildParticipants(
    orders: ExportOrder[],
    purchaseOrders: ExportPurchaseOrder[] = [],
): ExportParticipant[] {
    const map = new Map<number, ExportParticipant>();

    purchaseOrders.forEach((purchaseOrder) => {
        if (map.has(purchaseOrder.userId)) return;
        map.set(
            purchaseOrder.userId,
            participantFromUser(purchaseOrder.userId, purchaseOrder.id, purchaseOrder.user),
        );
    });

    orders.forEach((order) => {
        if (map.has(order.userId)) return;
        map.set(order.userId, participantFromUser(order.userId, order.purchaseOrderId ?? null, order.user));
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export type ParticipantPaymentSummary = {
    userId: number;
    due: number;
    paid: number;
    pending: number;
    status: PaymentStatus;
};

export function buildParticipantSummary(
    participants: ExportParticipant[],
    orders: ExportOrder[],
    payments: ExportPayment[],
): ParticipantPaymentSummary[] {
    const dueByUser = new Map<number, number>();
    orders.forEach((order) => {
        dueByUser.set(order.userId, (dueByUser.get(order.userId) ?? 0) + toNumber(order.amountDue));
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

    return participants.map((participant) => {
        const due = roundMoney(dueByUser.get(participant.userId) ?? 0);
        const paid = roundMoney(paidByUser.get(participant.userId) ?? 0);
        const pending = roundMoney(pendingByUser.get(participant.userId) ?? 0);
        return {
            userId: participant.userId,
            due,
            paid,
            pending,
            status: getPaymentStatus(due, paid),
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
