'use client';

import { ListTree, SearchX } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ListPagination } from '@/components/shared/list-pagination';
import { UserProfileSheet } from '@/components/shared/user-profile-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { formatPaidPercent, formatRub } from '@/lib/format/money';

import { useParticipantOrderActions, usePurchaseDetail } from '../../hooks';
import {
    buildItemOrdersViews,
    filterItemOrdersViews,
    type ItemFilter,
} from '../../lib/item-orders-views';
import type { OrderLineRef, PurchaseDetail } from '../../lib/types';
import { ItemOrdersCard } from './item-orders-card';
import { ItemOrdersFilters } from './item-orders-filters';

interface ItemOrdersTabProps {
    purchaseId: number;
    avatarByUser?: Map<number, string | null>;
}

interface DeleteLineTarget {
    line: OrderLineRef;
    itemTitle: string;
    userName: string;
}

const PAGE_SIZE = 20;

export function ItemOrdersTab({ purchaseId, avatarByUser }: ItemOrdersTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { orgFeeDefaultPercent } = usePricingSettings();
    const orderActions = useParticipantOrderActions(purchaseId);

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ItemFilter>('with_orders');
    const [page, setPage] = useState(1);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteLineTarget | null>(null);
    const [deletingLineIds, setDeletingLineIds] = useState<ReadonlySet<number>>(new Set());
    const deferredSearch = useDeferredValue(search);

    const typedPurchase = purchase as PurchaseDetail | undefined;
    const items = useMemo(() => typedPurchase?.items ?? [], [typedPurchase]);

    useEffect(() => {
        setPage(1);
    }, [deferredSearch, filter]);

    const views = useMemo(
        () => (typedPurchase ? buildItemOrdersViews(items, typedPurchase, orgFeeDefaultPercent) : []),
        [items, typedPurchase, orgFeeDefaultPercent],
    );
    const filtered = useMemo(() => filterItemOrdersViews(views, filter, deferredSearch), [views, filter, deferredSearch]);

    const withOrders = views.filter((v) => v.lines.length > 0);
    const totalDue = withOrders.reduce((sum, v) => sum + v.totalDue, 0);
    const totalCovered = withOrders.reduce((sum, v) => sum + v.covered, 0);
    const deficitCount = views.filter((v) => v.isDeficit).length;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedViews = useMemo(
        () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [filtered, currentPage],
    );

    if (isLoading || !typedPurchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={ListTree} value={withOrders.length} label="С заказами" hint={`из ${items.length}`} />
                <StatCard value={formatRub(totalDue)} label="Заказано на сумму" />
                <StatCard
                    value={formatRub(totalCovered)}
                    label="Покрыто"
                    accent={totalDue > 0 && totalCovered >= totalDue ? 'success' : 'neutral'}
                    hint={formatPaidPercent(totalCovered, totalDue)}
                />
                <StatCard value={deficitCount} label="Дефицитных" hint="заказано > собрано" />
            </div>

            <ItemOrdersFilters search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} />

            {filtered.length === 0 ? (
                <div className="rounded-2xl bg-bg-soft">
                    <EmptyState
                        icon={deferredSearch.trim() ? SearchX : ListTree}
                        title={deferredSearch.trim() ? 'Ничего не найдено' : 'Нет товаров под фильтром'}
                        description={
                            deferredSearch.trim()
                                ? 'Попробуйте изменить запрос — поиск идёт по названию, артикулу, бренду и комментарию.'
                                : 'Смените фильтр или дождитесь заказов участников.'
                        }
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    {pagedViews.map((v) => (
                        <ItemOrdersCard
                            key={v.item.id}
                            item={v.item}
                            lines={v.lines}
                            collected={v.collected}
                            remainder={v.remainder}
                            totalDue={v.totalDue}
                            covered={v.covered}
                            lastAddedAt={v.lastAddedAt}
                            unitPriceRub={v.unitPriceRub}
                            avatarByUser={avatarByUser}
                            onOpenProfile={setProfileUserId}
                            deletingLineIds={deletingLineIds}
                            onDeleteLine={(line) =>
                                setDeleteTarget({
                                    line,
                                    itemTitle: v.item.product?.name ?? 'Товар',
                                    userName:
                                        [line.user?.firstName, line.user?.lastName]
                                            .filter(Boolean)
                                            .join(' ')
                                            .trim() || `Участник #${line.userId}`,
                                })
                            }
                        />
                    ))}
                </div>
            )}

            <ListPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} label="Страницы" />

            <UserProfileSheet
                userId={profileUserId}
                open={profileUserId != null}
                onOpenChange={(open) => {
                    if (!open) setProfileUserId(null);
                }}
            />

            <ConfirmDialog
                open={deleteTarget != null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Удалить позицию?"
                description={
                    deleteTarget ? (
                        <>
                            Позиция «{deleteTarget.itemTitle}» у {deleteTarget.userName} будет удалена целиком.
                            Действие нельзя отменить.
                        </>
                    ) : null
                }
                confirmLabel="Удалить"
                onConfirm={() => {
                    if (!deleteTarget) return;
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    setDeletingLineIds((prev) => new Set(prev).add(target.line.id));
                    void orderActions
                        .deleteLineForUser({ id: target.line.id, userId: target.line.userId })
                        .catch(() => undefined)
                        .finally(() => {
                            setDeletingLineIds((prev) => {
                                if (!prev.has(target.line.id)) return prev;
                                const next = new Set(prev);
                                next.delete(target.line.id);
                                return next;
                            });
                        });
                }}
            />
        </div>
    );
}
