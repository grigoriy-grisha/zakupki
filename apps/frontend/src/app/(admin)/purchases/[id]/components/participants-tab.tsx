'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useParticipantsData } from '../hooks';
import { ParticipantRow } from './participant-row';
import { PaymentDetailDialog } from './payment-detail-dialog';
import { AddPaymentDialog } from './add-payment-dialog';

interface ParticipantsTabProps {
    purchaseId: number;
}

export function ParticipantsTab({ purchaseId }: ParticipantsTabProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const data = useParticipantsData(purchaseId);

    if (data.isLoading) {
        return <Skeleton className="h-64" />;
    }

    if (data.isEmpty) {
        return <p className="py-8 text-center text-muted-foreground">Заказов пока нет</p>;
    }

    const selectedPayment = data.payments?.find((p) => p.id === selectedPaymentId) as {
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="text-lg font-medium text-foreground">Участники</span>
                    <span>{data.userIds.length} чел.</span>
                    <span>
                        К оплате:{' '}
                        <span className="font-medium text-foreground">{data.totalDue.toLocaleString('ru-RU')} ₽</span>
                    </span>
                    <span>
                        Покрыто:{' '}
                        <span
                            className={cn(
                                'font-medium',
                                data.totalPaid >= data.totalDue ? 'text-success' : 'text-foreground',
                            )}
                        >
                            {data.totalPaid.toLocaleString('ru-RU')} ₽
                        </span>
                    </span>
                    {data.totalPending > 0 && (
                        <span>
                            Ожидает:{' '}
                            <span className="font-medium text-warning">
                                {data.totalPending.toLocaleString('ru-RU')} ₽
                            </span>
                        </span>
                    )}
                </div>
                <AddPaymentDialog purchaseId={purchaseId} />
            </div>

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
                        {data.userIds.map((userId) => {
                            const userOrdersList = data.userOrders.get(userId) ?? [];
                            const due = userOrdersList.reduce((sum, o) => sum + Number(o.amountDue), 0);
                            const paid = data.paidByUser.get(userId) ?? 0;
                            const pending = data.pendingByUser.get(userId) ?? 0;
                            const info = data.userMap.get(userId);
                            const name = info?.name ?? `Участник #${userId}`;
                            const userPaymentsList = data.userPayments.get(userId) ?? [];

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
