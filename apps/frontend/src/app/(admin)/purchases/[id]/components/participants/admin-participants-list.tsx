'use client';

import { useMemo, useState } from 'react';
import { Search, UsersIcon } from 'lucide-react';

import { UserProfileSheet } from '@/app/(admin)/users/components';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { cn, safeNumber } from '@/lib/utils';
import { getPaymentStatus, type PaymentStatus } from '../../../lib/payment-status';
import { useParticipantsData, usePurchaseDetail } from '../../hooks';
import type { PaymentRef } from '../../lib/types';
import { PaymentDetailDialog } from '../payment-detail-dialog';
import { AddParticipantDialog } from './add-participant-dialog';
import { AdminParticipantRow } from './admin-participant-row';

interface AdminParticipantsListProps {
    purchaseId: number;
}

type StatusFilter = PaymentStatus | 'all';

export function AdminParticipantsList({ purchaseId }: AdminParticipantsListProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const data = useParticipantsData(purchaseId);
    // Позиции закупки — для шага ± и пикера «добавить позицию» в карточке.
    // React Query дедуплицирует с таким же запросом из items-вкладки.
    const { detail: purchase } = usePurchaseDetail(purchaseId);
    const purchaseItems = purchase?.items ?? [];

    if (data.isLoading) {
        return <div className="h-32 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    if (data.isEmpty) {
        return (
            <div className="space-y-3">
                <SectionHeader
                    title="Участники"
                    description="Заказы и оплаты участников закупки."
                    actions={<AddParticipantDialog purchaseId={purchaseId} existingUserIds={new Set(data.userIds)} />}
                />
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

    // Фильтр участников по имени/@username и статусу оплаты.
    const filteredUserIds = useMemo(() => {
        const q = search.trim().toLowerCase().replace(/^@/, '');
        return data.userIds.filter((uid) => {
            const info = data.userMap.get(uid);
            const name = (info?.name ?? `Участник #${uid}`).toLowerCase();
            const uname = (info?.username ?? '').toLowerCase();
            const matchesSearch = !q || name.includes(q) || uname.includes(q);
            if (!matchesSearch) return false;
            if (statusFilter === 'all') return true;
            const userOrdersList = data.userOrders.get(uid) ?? [];
            const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
            const paid = data.paidByUser.get(uid) ?? 0;
            return getPaymentStatus(due, paid) === statusFilter;
        });
    }, [data.userIds, data.userMap, data.userOrders, data.paidByUser, search, statusFilter]);

    // Счётчики для фильтра-статуса (по всем участникам, без текстового поиска).
    const statusCounts = useMemo(() => {
        const counts = { all: data.userIds.length, paid: 0, partial: 0, unpaid: 0 } as Record<
            StatusFilter,
            number
        >;
        for (const uid of data.userIds) {
            const userOrdersList = data.userOrders.get(uid) ?? [];
            const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
            const paid = data.paidByUser.get(uid) ?? 0;
            counts[getPaymentStatus(due, paid)] += 1;
        }
        return counts;
    }, [data.userIds, data.userOrders, data.paidByUser]);

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Участники"
                description="Заказы и оплаты участников закупки."
                actions={<AddParticipantDialog purchaseId={purchaseId} existingUserIds={new Set(data.userIds)} />}
            />

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
                {/* Поиск участников по имени/@username. Все карточки раскрыты по умолчанию,
                    чтобы видеть заказы сразу без раскрытия каждой. */}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                    <Input
                        placeholder="Поиск участника по имени или @username…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 rounded-full pl-9 text-13-regular"
                    />
                </div>

                {/* Фильтр по статусу оплаты. Счётчики — по всем участникам,
                    независимо от текстового поиска. */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip
                        label="Все"
                        count={statusCounts.all}
                        active={statusFilter === 'all'}
                        onClick={() => setStatusFilter('all')}
                    />
                    <StatusChip
                        label="Оплачено"
                        count={statusCounts.paid}
                        active={statusFilter === 'paid'}
                        activeClass="border-success/40 bg-success/10 text-success"
                        onClick={() => setStatusFilter('paid')}
                    />
                    <StatusChip
                        label="Частично"
                        count={statusCounts.partial}
                        active={statusFilter === 'partial'}
                        activeClass="border-warning/40 bg-warning/10 text-warning"
                        onClick={() => setStatusFilter('partial')}
                    />
                    <StatusChip
                        label="Не оплачено"
                        count={statusCounts.unpaid}
                        active={statusFilter === 'unpaid'}
                        activeClass="border-error/40 bg-error/10 text-error"
                        onClick={() => setStatusFilter('unpaid')}
                    />
                </div>

                {filteredUserIds.length === 0 && (
                    <div className="rounded-2xl border border-border bg-bg-card py-8 text-center">
                        <p className="text-13-regular text-fg-tertiary">
                            {search.trim()
                                ? 'Ничего не найдено'
                                : statusFilter !== 'all'
                                  ? 'Нет участников с этим статусом'
                                  : 'Участников нет'}
                        </p>
                    </div>
                )}

                {filteredUserIds.map((userId) => {
                    const userOrdersList = data.userOrders.get(userId) ?? [];
                    const due = userOrdersList.reduce(
                        (sum, o) => sum + safeNumber(o.amountDue),
                        0,
                    );
                    const paid = data.paidByUser.get(userId) ?? 0;
                    const pending = data.pendingByUser.get(userId) ?? 0;
                    const info = data.userMap.get(userId);
                    const name = info?.name ?? `Участник #${userId}`;
                    const userPaymentsList = data.userPayments.get(userId) ?? [];
                    const orderComment = data.orderComments.get(userId) ?? null;
                    const purchaseOrderId = orderComment?.id ?? null;

                    return (
                        <AdminParticipantRow
                            key={userId}
                            userId={userId}
                            name={name}
                            username={info?.username}
                            purchaseId={purchaseId}
                            purchaseOrderId={purchaseOrderId}
                            orderComment={orderComment}
                            onOpenProfile={setProfileUserId}
                            orders={userOrdersList}
                            payments={userPaymentsList}
                            purchaseItems={purchaseItems}
                            due={due}
                            paid={paid}
                            pending={pending}
                            defaultOpen
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

/** Чип фильтра по статусу оплаты с счётчиком. */
function StatusChip({
    label,
    count,
    active,
    activeClass,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    activeClass?: string;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'h-7 gap-1.5 rounded-full px-3 text-12-medium',
                active ? (activeClass ?? 'border-primary/40 bg-primary/10 text-primary') : 'text-fg-secondary',
            )}
        >
            {label}
            <span className="tabular-nums opacity-70">{count}</span>
        </Button>
    );
}
