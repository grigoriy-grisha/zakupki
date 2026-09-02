'use client';

import { HANDOFF_DEFAULT_LABEL, HANDOFF_STATUS_LABELS, type HandoffStatus } from '@zakupki/types';
import { Search, SearchX, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { UserProfileSheet } from '@/app/(admin)/users/components';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { formatRub } from '@/lib/format/money';
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
type HandoffFilter = HandoffStatus | 'none' | 'all';

export function AdminParticipantsList({ purchaseId }: AdminParticipantsListProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [handoffFilter, setHandoffFilter] = useState<HandoffFilter>('all');

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
                <div className="rounded-2xl bg-bg-soft">
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

    // Фильтр участников по имени/@username, статусу оплаты и статусу выдачи.
    const filteredUserIds = useMemo(() => {
        const q = search.trim().toLowerCase().replace(/^@/, '');
        return data.userIds.filter((uid) => {
            const info = data.userMap.get(uid);
            const name = (info?.name ?? `Участник #${uid}`).toLowerCase();
            const uname = (info?.username ?? '').toLowerCase();
            if (q) {
                const comment = (data.orderComments.get(uid)?.comment ?? '').toLowerCase();
                const hasItemCommentMatch = (data.userOrders.get(uid) ?? []).some((o) =>
                    (o.purchaseItem?.adminComment ?? '').toLowerCase().includes(q),
                );
                const matchesSearch =
                    name.includes(q) || uname.includes(q) || comment.includes(q) || hasItemCommentMatch;
                if (!matchesSearch) return false;
            }
            if (statusFilter !== 'all') {
                const userOrdersList = data.userOrders.get(uid) ?? [];
                const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
                const paid = data.paidByUser.get(uid) ?? 0;
                if (getPaymentStatus(due, paid) !== statusFilter) return false;
            }
            if (handoffFilter !== 'all') {
                const handoff = data.handoffByUser.get(uid) ?? null;
                if (handoff !== handoffFilter) return false;
            }
            return true;
        });
    }, [
        data.userIds,
        data.userMap,
        data.userOrders,
        data.paidByUser,
        data.handoffByUser,
        data.orderComments,
        search,
        statusFilter,
        handoffFilter,
    ]);

    // Счётчики для фильтра-статуса (по всем участникам, без текстового поиска).
    const statusCounts = useMemo(() => {
        const counts = { all: data.userIds.length, paid: 0, partial: 0, unpaid: 0 } as Record<StatusFilter, number>;
        for (const uid of data.userIds) {
            const userOrdersList = data.userOrders.get(uid) ?? [];
            const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
            const paid = data.paidByUser.get(uid) ?? 0;
            counts[getPaymentStatus(due, paid)] += 1;
        }
        return counts;
    }, [data.userIds, data.userOrders, data.paidByUser]);

    const handoffCounts = useMemo(() => {
        const counts: Record<HandoffFilter, number> = {
            all: data.userIds.length,
            none: 0,
            SENT: 0,
            RECEIVED: 0,
            STORED: 0,
        };
        for (const uid of data.userIds) {
            const handoff = data.handoffByUser.get(uid) ?? null;
            if (handoff == null) counts.none += 1;
            else counts[handoff] += 1;
        }
        return counts;
    }, [data.userIds, data.handoffByUser]);

    const handoffDone = data.userIds.length - handoffCounts.none;

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Участники"
                description="Заказы и оплаты участников закупки."
                actions={<AddParticipantDialog purchaseId={purchaseId} existingUserIds={new Set(data.userIds)} />}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={UsersIcon} value={data.userIds.length} label="Участников" hint="чел." />
                <StatCard value={`${formatRub(data.totalDue)}`} label="К оплате" />
                <StatCard
                    value={`${formatRub(data.totalPaid)}`}
                    label="Покрыто"
                    accent={data.totalPaid >= data.totalDue && data.totalDue > 0 ? 'success' : 'neutral'}
                />
                {data.totalPending > 0 && (
                    <StatCard value={`${formatRub(data.totalPending)}`} label="Ожидает" accent="warning" />
                )}
            </div>

            <div className="space-y-2">
                {/* Поиск участников по имени/@username. Все карточки раскрыты по умолчанию,
                    чтобы видеть заказы сразу без раскрытия каждой. */}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                    <Input
                        placeholder="Поиск: имя, @username, комментарий участника или товара…"
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

                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip
                        label={HANDOFF_DEFAULT_LABEL}
                        count={handoffCounts.none}
                        active={handoffFilter === 'none'}
                        onClick={() => setHandoffFilter('none')}
                    />
                    <StatusChip
                        label={HANDOFF_STATUS_LABELS.SENT}
                        count={handoffCounts.SENT}
                        active={handoffFilter === 'SENT'}
                        activeClass="border-secondary/40 bg-secondary/10 text-secondary"
                        onClick={() => setHandoffFilter('SENT')}
                    />
                    <StatusChip
                        label={HANDOFF_STATUS_LABELS.RECEIVED}
                        count={handoffCounts.RECEIVED}
                        active={handoffFilter === 'RECEIVED'}
                        activeClass="border-success/40 bg-success/10 text-success"
                        onClick={() => setHandoffFilter('RECEIVED')}
                    />
                    <StatusChip
                        label="На хранении"
                        count={handoffCounts.STORED}
                        active={handoffFilter === 'STORED'}
                        activeClass="border-warning/40 bg-warning/10 text-warning"
                        onClick={() => setHandoffFilter('STORED')}
                    />
                    <span className="ml-auto hidden text-12-regular text-fg-tertiary sm:block">
                        Статус выдачи проставлен: {handoffDone} из {data.userIds.length}
                    </span>
                </div>

                {filteredUserIds.length === 0 && (
                    <div className="rounded-2xl bg-bg-soft">
                        <EmptyState
                            icon={search.trim() ? SearchX : UsersIcon}
                            title={
                                search.trim()
                                    ? 'Ничего не найдено'
                                    : statusFilter !== 'all' || handoffFilter !== 'all'
                                      ? 'Нет участников с этим статусом'
                                      : 'Участников нет'
                            }
                            description={
                                search.trim()
                                    ? 'Попробуйте изменить запрос — поиск идёт по имени, @username и комментариям.'
                                    : statusFilter !== 'all' || handoffFilter !== 'all'
                                      ? 'Смените фильтр или сбросьте его, чтобы увидеть всех участников.'
                                      : 'Когда участники оформят заказы, они появятся здесь'
                            }
                        />
                    </div>
                )}

                {filteredUserIds.map((userId) => {
                    const userOrdersList = data.userOrders.get(userId) ?? [];
                    const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
                    const paid = data.paidByUser.get(userId) ?? 0;
                    const pending = data.pendingByUser.get(userId) ?? 0;
                    const info = data.userMap.get(userId);
                    const name = info?.name ?? `Участник #${userId}`;
                    const userPaymentsList = data.userPayments.get(userId) ?? [];
                    const orderComment = data.orderComments.get(userId) ?? null;
                    const purchaseOrderId = orderComment?.id ?? null;
                    const handoffStatus = data.handoffByUser.get(userId) ?? null;

                    return (
                        <AdminParticipantRow
                            key={userId}
                            userId={userId}
                            name={name}
                            username={info?.username}
                            consentAt={info?.consentAt ?? null}
                            purchaseId={purchaseId}
                            purchaseOrderId={purchaseOrderId}
                            orderComment={orderComment}
                            handoffStatus={handoffStatus}
                            searchQuery={search}
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
                active ? (activeClass ?? 'border-secondary/40 bg-secondary/10 text-secondary') : 'text-fg-secondary',
            )}
        >
            {label}
            <span className="tabular-nums opacity-70">{count}</span>
        </Button>
    );
}
