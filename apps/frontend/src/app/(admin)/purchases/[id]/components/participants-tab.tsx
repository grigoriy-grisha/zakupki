'use client';

import { useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { paymentTotal } from '../../lib/utils';
import { ParticipantRow } from './participant-row';
import { PaymentDetailDialog } from './payment-detail-dialog';
import { AddPaymentDialog } from './add-payment-dialog';
interface ParticipantsTabProps {
    purchaseId: number;
}

export function ParticipantsTab({ purchaseId }: ParticipantsTabProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const { data: orders, isLoading: ordersLoading } = trpc.orders.getAllByPurchase.useQuery({ purchaseId });
    const { data: payments, isLoading: paymentsLoading } = trpc.payments.getByPurchase.useQuery({ purchaseId });

    if (ordersLoading || paymentsLoading) {
        return <Skeleton className="h-64" />;
    }

    if (!orders?.length) {
        return <p className="py-8 text-center text-muted-foreground">Заказов пока нет</p>;
    }

    // User info map
    const userMap = new Map<number, { name: string; username?: string }>();
    orders.forEach((o) => {
        if (
            !userMap.has(o.userId) &&
            (o as { user?: { firstName: string; lastName?: string | null; username?: string } }).user
        ) {
            const u = (o as { user: { firstName: string; lastName?: string | null; username?: string } }).user;
            userMap.set(o.userId, {
                name: [u.firstName, u.lastName].filter(Boolean).join(' '),
                username: u.username,
            });
        }
    });

    // Group orders by user
    const userOrders = new Map<number, (typeof orders)[number][]>();
    orders.forEach((o) => {
        if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
        userOrders.get(o.userId)!.push(o);
    });

    // Group payments by user
    const userPayments = new Map<number, typeof payments extends (infer T)[] | null | undefined ? T[] : never>();
    payments?.forEach((p) => {
        if (!userPayments.has(p.userId)) userPayments.set(p.userId, []);
        userPayments.get(p.userId)!.push(p);
    });

    // Calculate paid/pending per user
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

    // Global stats
    const totalDue = orders.reduce((sum, o) => sum + Number(o.amountDue), 0);
    const totalPaid =
        payments?.reduce(
            (sum, p) => sum + paymentTotal(p as { amount: unknown; children?: { amount: unknown }[] }),
            0,
        ) ?? 0;
    const totalPending =
        payments
            ?.filter((p) => (p as { status: string }).status === 'PENDING')
            .reduce((sum, p) => sum + paymentTotal(p as { amount: unknown; children?: { amount: unknown }[] }), 0) ?? 0;

    const userIds = Array.from(userOrders.keys());

    const selectedPayment = payments?.find((p) => p.id === selectedPaymentId) as {
        id: number;
        userId: number;
        amount: unknown;
        status: string;
        paidAt: string;
        userComment?: string;
        adminNote?: string;
        proofData?: unknown;
        proofMimeType?: string;
        user?: { firstName: string; lastName?: string | null };
        children?: { amount: unknown; promoCode: { code: string } | null }[];
    } | null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="text-lg font-medium text-foreground">Участники</span>
                    <span>{userIds.length} чел.</span>
                    <span>
                        К оплате:{' '}
                        <span className="font-medium text-foreground">{totalDue.toLocaleString('ru-RU')} ₽</span>
                    </span>
                    <span>
                        Покрыто:{' '}
                        <span className={cn('font-medium', totalPaid >= totalDue ? 'text-success' : 'text-foreground')}>
                            {totalPaid.toLocaleString('ru-RU')} ₽
                        </span>
                    </span>
                    {totalPending > 0 && (
                        <span>
                            Ожидает:{' '}
                            <span className="font-medium text-warning">{totalPending.toLocaleString('ru-RU')} ₽</span>
                        </span>
                    )}
                </div>
                <AddPaymentDialog purchaseId={purchaseId} />
            </div>

            {/* Participants table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Участник</TableHead>
                            <TableHead className="text-center">Позиций</TableHead>
                            <TableHead className="text-right">К оплате</TableHead>
                            <TableHead className="text-right">Покрыто</TableHead>
                            <TableHead className="text-center">Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {userIds.map((userId) => {
                            const userOrdersList = userOrders.get(userId) ?? [];
                            const due = userOrdersList.reduce((sum, o) => sum + Number(o.amountDue), 0);
                            const paid = paidByUser.get(userId) ?? 0;
                            const pending = pendingByUser.get(userId) ?? 0;
                            const info = userMap.get(userId);
                            const name = info?.name ?? `Участник #${userId}`;
                            const userPaymentsList = userPayments.get(userId) ?? [];

                            return (
                                <ParticipantRow
                                    key={userId}
                                    name={name}
                                    username={info?.username}
                                    orders={userOrdersList}
                                    payments={userPaymentsList}
                                    due={due}
                                    paid={paid}
                                    pending={pending}
                                    onPaymentClick={(id) => {
                                        setSelectedPaymentId(id);
                                        setDetailOpen(true);
                                    }}
                                />
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Payment detail dialog */}
            {selectedPayment && (
                <PaymentDetailDialog
                    payment={selectedPayment}
                    open={detailOpen}
                    onOpenChange={(open) => {
                        setDetailOpen(open);
                        if (!open) setSelectedPaymentId(null);
                    }}
                    purchaseId={purchaseId}
                />
            )}
        </div>
    );
}
