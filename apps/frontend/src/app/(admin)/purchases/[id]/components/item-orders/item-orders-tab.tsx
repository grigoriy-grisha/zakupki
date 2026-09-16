'use client';

import { ListTree, Search, SearchX } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/shared/list-pagination';
import { UserProfileSheet } from '@/components/shared/user-profile-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { formatPaidPercent, formatRub } from '@/lib/format/money';
import { paymentTotal } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

import { usePurchaseDetail } from '../../hooks/use-purchase-detail';
import { getCollectedQty, getRemainderQty, getUnitPriceWithDeliveryRub } from '../../lib/items-table-pricing';
import type { OrderLineRef, PurchaseDetail, PurchaseItem } from '../../lib/types';
import { ItemOrdersCard } from './item-orders-card';

interface ItemOrdersTabProps {
    purchaseId: number;
    /** Аватарки участников (из useParticipantsData: User.avatarUrl + TG/VK credentials). */
    avatarByUser?: Map<number, string | null>;
}

type ItemFilter = 'with_orders' | 'all' | 'deficit' | 'supplement';

const PAGE_SIZE = 20;

interface ItemOrdersView {
    item: PurchaseItem;
    lines: OrderLineRef[];
    collected: number;
    remainder: number | null;
    totalDue: number;
    covered: number;
    lastAddedAt: Date | null;
    unitPriceRub: number | null;
    hasSupplement: boolean;
    isDeficit: boolean;
}

const FILTERS: { id: ItemFilter; label: string }[] = [
    { id: 'with_orders', label: 'С заказами' },
    { id: 'deficit', label: 'Дефицит' },
    { id: 'supplement', label: 'С добором' },
    { id: 'all', label: 'Все' },
];

export function ItemOrdersTab({ purchaseId, avatarByUser }: ItemOrdersTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { orgFeeDefaultPercent } = usePricingSettings();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ItemFilter>('with_orders');
    const [page, setPage] = useState(1);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const deferredSearch = useDeferredValue(search);

    const typedPurchase = purchase as PurchaseDetail | undefined;
    const items = useMemo(() => typedPurchase?.items ?? [], [typedPurchase]);
    const currencyRates = typedPurchase?.currencyRates ?? [];
    const deliveryPercent = Number(typedPurchase?.deliveryPercent ?? 0);

    useEffect(() => {
        setPage(1);
    }, [deferredSearch, filter]);

    const views = useMemo<ItemOrdersView[]>(() => {
        const payments = typedPurchase?.payments ?? [];
        const paidByUser = new Map<number, number>();
        for (const p of payments) {
            if (p.status !== 'CONFIRMED') continue;
            paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + paymentTotal(p));
        }
        const dueByUser = new Map<number, number>();
        for (const item of items) {
            for (const line of item.orderLines) {
                if (line.status === 'CANCELLED') continue;
                dueByUser.set(line.userId, (dueByUser.get(line.userId) ?? 0) + Number(line.amountDue ?? 0));
            }
        }
        const shareByUser = new Map<number, number>();
        for (const [userId, due] of dueByUser) {
            if (due <= 0) continue;
            shareByUser.set(userId, Math.min(1, (paidByUser.get(userId) ?? 0) / due));
        }

        return items.map((item) => {
            const lines = item.orderLines
                .filter((l) => l.status !== 'CANCELLED')
                .slice()
                .sort((a, b) => {
                    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    return diff !== 0 ? diff : b.id - a.id;
                });
            const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue ?? 0), 0);
            const covered = lines.reduce(
                (sum, l) => sum + Number(l.amountDue ?? 0) * (shareByUser.get(l.userId) ?? 0),
                0,
            );
            const collected = getCollectedQty(item);
            const remainder = getRemainderQty(item, typedPurchase?.fulfillmentStatus);
            const lastAddedAt = lines.length > 0 ? new Date(lines[0].createdAt) : null;
            const hasSupplement = lines.some((l) => (l.createdOnStage ?? 'COLLECTION') !== 'COLLECTION');
            const isDeficit = remainder != null && remainder > 1e-9;
            return {
                item,
                lines,
                collected,
                remainder,
                totalDue,
                covered,
                lastAddedAt,
                unitPriceRub: getUnitPriceWithDeliveryRub(item, currencyRates, orgFeeDefaultPercent, deliveryPercent),
                hasSupplement,
                isDeficit,
            };
        });
    }, [items, typedPurchase, currencyRates, orgFeeDefaultPercent, deliveryPercent]);

    const filtered = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        const matched = views.filter((v) => {
            if (filter === 'with_orders' && v.lines.length === 0) return false;
            if (filter === 'deficit' && !v.isDeficit) return false;
            if (filter === 'supplement' && !v.hasSupplement) return false;
            if (!q) return true;
            const it = v.item;
            const haystack =
                `${it.product.name ?? ''} ${it.product.brand ?? ''} ${it.product.articleNumber ?? ''} ${it.adminComment ?? ''}`.toLowerCase();
            return haystack.includes(q);
        });
        return matched.sort((a, b) => {
            if (a.lastAddedAt && b.lastAddedAt) return b.lastAddedAt.getTime() - a.lastAddedAt.getTime();
            if (a.lastAddedAt) return -1;
            if (b.lastAddedAt) return 1;
            return a.item.id - b.item.id;
        });
    }, [views, deferredSearch, filter]);

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

            <div className="space-y-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                    <Input
                        placeholder="Поиск: название, артикул, бренд, комментарий…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 rounded-full pl-9 text-13-regular"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}
                            className={cn(
                                'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3',
                                'text-12-bold transition-colors',
                                filter === f.id
                                    ? 'border-secondary bg-secondary text-primary-foreground'
                                    : 'border-border-low text-secondary hover:bg-secondary/10',
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

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
        </div>
    );
}
