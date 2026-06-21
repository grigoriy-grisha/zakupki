'use client';

import { useState } from 'react';
import { UsersIcon } from 'lucide-react';

import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { UserProfileSheet } from '@/app/(admin)/users/components';
import { PaymentDetailDialog } from './payment-detail-dialog';
import { useParticipantsData } from '../hooks';
import { AdminParticipantRow } from './admin-participant-row';
import type { PaymentRef } from '../lib/types';

interface AdminParticipantsListProps {
    purchaseId: number;
}

export function AdminParticipantsList({ purchaseId }: AdminParticipantsListProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);

    const data = useParticipantsData(purchaseId);

    if (data.isLoading) {
        return <div className="h-32 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    if (data.isEmpty) {
        return (
            <div className="space-y-3">
                <SectionHeader title="Участники" description="Заказы и оплаты участников закупки." />
                <div className="rounded-2xl border border-border bg-bg-card">
                    <EmptyState
                        icon={UsersIcon}
                        title="Заказов пока нет"
                        description="Когда участники оформят заказы, они появятся здесь"
                    />
                </div>
            </div>
        );
    }

    const selectedPayment = data.payments.find((p) => p.id === selectedPaymentId) ?? null;

    return (
        <div className="space-y-4">
            <SectionHeader title="Участники" description="Заказы и оплаты участников закупки." />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    icon={UsersIcon}
                    value={data.userIds.length}
                    label="Участников"
                    hint="чел."
                />
                <StatCard
                    value={`${data.totalDue.toLocaleString('ru-RU')} ₽`}
                    label="К оплате"
                />
                <StatCard
                    value={`${data.totalPaid.toLocaleString('ru-RU')} ₽`}
                    label="Покрыто"
                    accent={data.totalPaid >= data.totalDue && data.totalDue > 0 ? 'success' : 'neutral'}
                />
                {data.totalPending > 0 && (
                    <StatCard
                        value={`${data.totalPending.toLocaleString('ru-RU')} ₽`}
                        label="Ожидает"
                        accent="warning"
                    />
                )}
            </div>

            <div className="space-y-2">
                {data.userIds.map((userId) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const userOrdersList: any[] = data.userOrders.get(userId) ?? [];
                    const due = userOrdersList.reduce(
                        (sum: number, o: any) => sum + Number(o.amountDue),
                        0,
                    );
                    const paid = data.paidByUser.get(userId) ?? 0;
                    const pending = data.pendingByUser.get(userId) ?? 0;
                    const info = data.userMap.get(userId);
                    const name = info?.name ?? `Участник #${userId}`;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const userPaymentsList: any[] = data.userPayments.get(userId) ?? [];
                    const purchaseOrderId =
                        (userOrdersList[0] as { purchaseOrderId?: number | null } | undefined)
                            ?.purchaseOrderId ?? null;

                    return (
                        <AdminParticipantRow
                            key={userId}
                            userId={userId}
                            name={name}
                            username={info?.username}
                            purchaseId={purchaseId}
                            purchaseOrderId={purchaseOrderId}
                            onOpenProfile={setProfileUserId}
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
            </div>

            {selectedPayment && (
                <PaymentDetailDialog
                    payment={selectedPayment as PaymentRef}
                    open={detailOpen}
                    onOpenChange={(open) => {
                        setDetailOpen(open);
                        if (!open) setSelectedPaymentId(null);
                    }}
                    purchaseId={purchaseId}
                />
            )}

            <UserProfileSheet
                userId={profileUserId}
                open={profileUserId != null}
                onOpenChange={(open) => {
                    if (!open) setProfileUserId(null);
                }}
            />
        </div>
    );
}
