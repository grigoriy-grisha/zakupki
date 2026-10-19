'use client';

import { HANDOFF_DEFAULT_LABEL, HANDOFF_STATUS_LABELS, type HandoffStatus } from '@zakupki/types';
import { Search, SearchX, UsersIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/shared/list-pagination';
import { UserProfileSheet } from '@/components/shared/user-profile-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { formatPaidPercent, formatRub } from '@/lib/format/money';
import { cn, safeNumber } from '@/lib/utils';

import { getPaymentStatus, type PaymentStatus } from '../../../lib/payment-status';
import { useParticipantsData, usePurchaseDetail } from '../../hooks';
import type { PaymentRef } from '../../lib/types';
import { PaymentDetailDialog } from '../payment-detail-dialog';
import { AddParticipantDialog } from './add-participant-dialog';
import type { PurchaseItemOption } from './admin-order-controls';
import { AdminParticipantRow } from './admin-participant-row';
import type { ParticipantOrder } from './types';

const EMPTY_ORDERS: ParticipantOrder[] = [];
const EMPTY_PAYMENTS: PaymentRef[] = [];
const EMPTY_ITEMS: PurchaseItemOption[] = [];
const PARTICIPANTS_PAGE_SIZE = 20;

interface AdminParticipantsListProps {
    purchaseId: number;
}

type StatusFilter = PaymentStatus | 'awaiting_payment' | 'all';
type HandoffFilter = HandoffStatus | 'none' | 'all';

interface ParticipantMeta {
    uid: number;
    paymentStatus: PaymentStatus;
    awaitingPayment: boolean;
    handoff: HandoffStatus | null;
    matchesSearch: boolean;
}

function matchesStatusFilter(m: ParticipantMeta, filter: StatusFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'awaiting_payment') return m.awaitingPayment;
    return m.paymentStatus === filter;
}

function matchesHandoffFilter(m: ParticipantMeta, filter: HandoffFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'none') return m.handoff == null;
    return m.handoff === filter;
}

export function AdminParticipantsList({ purchaseId }: AdminParticipantsListProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [handoffFilter, setHandoffFilter] = useState<HandoffFilter>('all');

    const data = useParticipantsData(purchaseId);
    const { detail: purchase } = usePurchaseDetail(purchaseId);
    const purchaseItems = purchase?.items ?? EMPTY_ITEMS;
    const deferredSearch = useDeferredValue(search);

    const handlePaymentClick = useCallback((id: number) => {
        setSelectedPaymentId(id);
        setDetailOpen(true);
    }, []);

    useEffect(() => {
        setPage(1);
    }, [deferredSearch, statusFilter, handoffFilter]);

    // Мета участника считается один раз: статус оплаты, «ждёт подтверждения»,
    // статус выдачи и совпадение с поиском. Из неё строятся и список, и счётчики.
    // Хуки — до ранних return (загрузка/пусто), иначе нарушается порядок хуков.
    const participantMeta = useMemo<ParticipantMeta[]>(() => {
        const q = deferredSearch.trim().toLowerCase().replace(/^@/, '');
        return data.userIds.map((uid) => {
            const userOrdersList = data.userOrders.get(uid) ?? [];
            const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
            const paymentStatus = getPaymentStatus(due, data.paidByUser.get(uid) ?? 0);
            const awaitingPayment = (data.pendingByUser.get(uid) ?? 0) > 0 && paymentStatus !== 'paid';
            const handoff = data.handoffByUser.get(uid) ?? null;
            let matchesSearch = true;
            if (q) {
                const info = data.userMap.get(uid);
                const name = (info?.name ?? `Участник #${uid}`).toLowerCase();
                const uname = (info?.username ?? '').toLowerCase();
                const comment = (data.orderComments.get(uid)?.comment ?? '').toLowerCase();
                const hasItemCommentMatch = userOrdersList.some((o) =>
                    (o.purchaseItem?.adminComment ?? '').toLowerCase().includes(q),
                );
                matchesSearch = name.includes(q) || uname.includes(q) || comment.includes(q) || hasItemCommentMatch;
            }
            return { uid, paymentStatus, awaitingPayment, handoff, matchesSearch };
        });
    }, [
        data.userIds,
        data.userMap,
        data.userOrders,
        data.paidByUser,
        data.pendingByUser,
        data.handoffByUser,
        data.orderComments,
        deferredSearch,
    ]);

    const filteredUserIds = useMemo(
        () =>
            participantMeta
                .filter(
                    (m) =>
                        m.matchesSearch &&
                        matchesStatusFilter(m, statusFilter) &&
                        matchesHandoffFilter(m, handoffFilter),
                )
                .map((m) => m.uid),
        [participantMeta, statusFilter, handoffFilter],
    );

    // Счётчики фильтров оплаты учитывают выбранный статус выдачи (и поиск), и
    // наоборот — иначе при «Оплачено» чип «Ожидает выдачи» показывал общее число,
    // не совпадающее со списком.
    const statusCounts = useMemo(() => {
        const counts: Record<StatusFilter, number> = {
            all: 0,
            paid: 0,
            partial: 0,
            unpaid: 0,
            overpaid: 0,
            awaiting_payment: 0,
        };
        for (const m of participantMeta) {
            if (!m.matchesSearch || !matchesHandoffFilter(m, handoffFilter)) continue;
            counts.all += 1;
            counts[m.paymentStatus] += 1;
            if (m.awaitingPayment) counts.awaiting_payment += 1;
        }
        return counts;
    }, [participantMeta, handoffFilter]);

    const handoffCounts = useMemo(() => {
        const counts: Record<HandoffFilter, number> = {
            all: 0,
            none: 0,
            ASSEMBLED: 0,
            READY_TO_SHIP: 0,
            SENT: 0,
            RECEIVED: 0,
            STORED: 0,
        };
        for (const m of participantMeta) {
            if (!m.matchesSearch || !matchesStatusFilter(m, statusFilter)) continue;
            counts.all += 1;
            if (m.handoff == null) counts.none += 1;
            else counts[m.handoff] += 1;
        }
        return counts;
    }, [participantMeta, statusFilter]);

    const handoffDone = participantMeta.filter((m) => m.handoff != null).length;

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

    const totalPages = Math.max(1, Math.ceil(filteredUserIds.length / PARTICIPANTS_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedUserIds = filteredUserIds.slice(
        (currentPage - 1) * PARTICIPANTS_PAGE_SIZE,
        currentPage * PARTICIPANTS_PAGE_SIZE,
    );

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
                    hint={formatPaidPercent(data.totalPaid, data.totalDue)}
                />
                {data.totalPending > 0 && (
                    <StatCard value={`${formatRub(data.totalPending)}`} label="Ожидает" accent="warning" />
                )}
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                    <Input
                        placeholder="Поиск: имя, @username, комментарий участника или товара…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 rounded-full pl-9 text-13-regular"
                    />
                </div>

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
                    <StatusChip
                        label="Переплата"
                        count={statusCounts.overpaid}
                        active={statusFilter === 'overpaid'}
                        activeClass="border-warning/40 bg-warning/10 text-warning"
                        onClick={() => setStatusFilter('overpaid')}
                    />
                    <StatusChip
                        label="Ожидает оплаты"
                        count={statusCounts.awaiting_payment}
                        active={statusFilter === 'awaiting_payment'}
                        activeClass="border-warning/40 bg-warning/10 text-warning"
                        onClick={() => setStatusFilter('awaiting_payment')}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip
                        label="Все"
                        count={handoffCounts.all}
                        active={handoffFilter === 'all'}
                        onClick={() => setHandoffFilter('all')}
                    />
                    <StatusChip
                        label={HANDOFF_DEFAULT_LABEL}
                        count={handoffCounts.none}
                        active={handoffFilter === 'none'}
                        onClick={() => setHandoffFilter('none')}
                    />
                    <StatusChip
                        label={HANDOFF_STATUS_LABELS.ASSEMBLED}
                        count={handoffCounts.ASSEMBLED}
                        active={handoffFilter === 'ASSEMBLED'}
                        activeClass="border-primary/40 bg-primary/10 text-primary"
                        onClick={() => setHandoffFilter('ASSEMBLED')}
                    />
                    <StatusChip
                        label={HANDOFF_STATUS_LABELS.READY_TO_SHIP}
                        count={handoffCounts.READY_TO_SHIP}
                        active={handoffFilter === 'READY_TO_SHIP'}
                        activeClass="border-accent/40 bg-accent/10 text-accent"
                        onClick={() => setHandoffFilter('READY_TO_SHIP')}
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
                            icon={deferredSearch.trim() ? SearchX : UsersIcon}
                            title={
                                deferredSearch.trim()
                                    ? 'Ничего не найдено'
                                    : statusFilter !== 'all' || handoffFilter !== 'all'
                                      ? 'Нет участников с этим статусом'
                                      : 'Участников нет'
                            }
                            description={
                                deferredSearch.trim()
                                    ? 'Попробуйте изменить запрос — поиск идёт по имени, @username и комментариям.'
                                    : statusFilter !== 'all' || handoffFilter !== 'all'
                                      ? 'Смените фильтр или сбросьте его, чтобы увидеть всех участников.'
                                      : 'Когда участники оформят заказы, они появятся здесь'
                            }
                        />
                    </div>
                )}

                {pagedUserIds.map((userId) => {
                    const userOrdersList = data.userOrders.get(userId) ?? EMPTY_ORDERS;
                    const due = userOrdersList.reduce((sum, o) => sum + safeNumber(o.amountDue), 0);
                    const paid = data.paidByUser.get(userId) ?? 0;
                    const pending = data.pendingByUser.get(userId) ?? 0;
                    const info = data.userMap.get(userId);
                    const name = info?.name ?? `Участник #${userId}`;
                    const userPaymentsList = data.userPayments.get(userId) ?? EMPTY_PAYMENTS;
                    const orderComment = data.orderComments.get(userId) ?? null;
                    const purchaseOrderId = orderComment?.id ?? null;
                    const handoffStatus = data.handoffByUser.get(userId) ?? null;

                    return (
                        <AdminParticipantRow
                            key={userId}
                            userId={userId}
                            name={name}
                            username={info?.username}
                            avatarUrl={info?.avatarUrl ?? null}
                            consentAt={info?.consentAt ?? null}
                            purchaseId={purchaseId}
                            purchaseOrderId={purchaseOrderId}
                            orderComment={orderComment}
                            handoffStatus={handoffStatus}
                            searchQuery={deferredSearch}
                            onOpenProfile={setProfileUserId}
                            orders={userOrdersList}
                            payments={userPaymentsList}
                            purchaseItems={purchaseItems}
                            due={due}
                            paid={paid}
                            pending={pending}
                            defaultOpen
                            onPaymentClick={handlePaymentClick}
                        />
                    );
                })}

                <ListPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    label="Страницы участников"
                />
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
