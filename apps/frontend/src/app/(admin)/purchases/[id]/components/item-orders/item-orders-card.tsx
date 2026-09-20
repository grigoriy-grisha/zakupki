'use client';

import { formatQtyUnit, resolveUnit } from '@zakupki/types';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPaidPercent, formatRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

import type { OrderLineRef, PurchaseItem } from '../../lib/types';
import { QuantityDisplay } from '../participants/quantity-display';

export interface ItemOrdersCardProps {
    item: PurchaseItem;
    /** Активные строки, отсортированные по дате добавления (свежие сверху). */
    lines: OrderLineRef[];
    collected: number;
    remainder: number | null;
    totalDue: number;
    covered: number;
    lastAddedAt: Date | null;
    unitPriceRub: number | null;
    avatarByUser?: Map<number, string | null>;
    onOpenProfile?: (userId: number) => void;
    onDeleteLine?: (line: OrderLineRef) => void;
    deletingLineIds?: ReadonlySet<number>;
    defaultOpen?: boolean;
}

function formatDateTime(value: Date): string {
    return value.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ordersLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} заказ`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} заказа`;
    return `${count} заказов`;
}

export function ItemOrdersCard({
    item,
    lines,
    collected,
    remainder,
    totalDue,
    covered,
    lastAddedAt,
    unitPriceRub,
    avatarByUser,
    onOpenProfile,
    onDeleteLine,
    deletingLineIds,
    defaultOpen = false,
}: ItemOrdersCardProps) {
    const [open, setOpen] = useState(defaultOpen);
    const photos = [...(item.product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const photoId = photos[0]?.id;
    const unitCode = item.unitCode ?? item.product.unitCode;

    return (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/15 bg-bg-soft">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
            >
                {open ? (
                    <ChevronDown className="size-4 shrink-0 text-fg-secondary" />
                ) : (
                    <ChevronRight className="size-4 shrink-0 text-fg-secondary" />
                )}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {photoId && <img src={`/api/photos/${photoId}`} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                    <PurchaseProductLabel
                        product={item.product}
                        as="span"
                        className="block truncate text-13-medium text-fg-primary"
                    />
                    <p className="mt-0.5 truncate text-12-regular text-fg-tertiary">
                        {lines.length > 0
                            ? `${ordersLabel(lines.length)} · последний ${lastAddedAt ? formatDateTime(lastAddedAt) : '—'}`
                            : 'Заказов нет'}
                    </p>
                </div>
                <div className="hidden shrink-0 items-center gap-5 sm:flex">
                    <Stat label="Собрано" value={formatQty(collected, unitCode)} />
                    <Stat label="Остаток" value={remainder == null ? '—' : formatQty(remainder, unitCode)} />
                    <Stat label="Цена/ед" value={unitPriceRub != null ? formatRub(unitPriceRub) : '—'} />
                    <Stat label="Сумма" value={formatRub(totalDue)} />
                    <div className="text-right">
                        <p className="text-12-regular text-fg-tertiary">Покрыто</p>
                        <p className="text-14-semibold tabular-nums text-fg-primary">
                            {formatRub(covered)}
                            {totalDue > 0 && (
                                <span
                                    className={cn(
                                        'ml-1 text-12-medium',
                                        covered >= totalDue ? 'text-success' : 'text-fg-tertiary',
                                    )}
                                >
                                    {formatPaidPercent(covered, totalDue)}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </button>

            {open && (
                <div className="divide-y divide-border-soft border-t border-border-soft">
                    {lines.length === 0 ? (
                        <p className="px-3 py-3 text-13-regular text-fg-tertiary sm:px-4">Заказов пока нет.</p>
                    ) : (
                        lines.map((line, index) => {
                            const isLast = index === 0;
                            const isSupplement = (line.createdOnStage ?? 'COLLECTION') !== 'COLLECTION';
                            const isDeleting = deletingLineIds?.has(line.id) ?? false;
                            const userName = [line.user?.firstName, line.user?.lastName]
                                .filter(Boolean)
                                .join(' ')
                                .trim();
                            const avatarUrl = avatarByUser?.get(line.userId) ?? line.user?.avatarUrl ?? null;
                            return (
                                <div
                                    key={line.id}
                                    className={cn(
                                        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition-opacity sm:px-4',
                                        isDeleting && 'pointer-events-none opacity-30',
                                    )}
                                >
                                    <button
                                        type="button"
                                        title="Открыть профиль участника"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenProfile?.(line.userId);
                                        }}
                                        className={cn(
                                            'group flex max-w-full items-center gap-3 rounded-xl px-2 py-1 -mx-2 text-left',
                                            'transition-colors hover:bg-primary/10',
                                        )}
                                    >
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-12-semibold text-primary">
                                            {avatarUrl ? (
                                                <UserAvatar src={avatarUrl} className="size-7" />
                                            ) : (
                                                (userName || '?').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <span className="block min-w-0">
                                            <span className="block truncate text-13-medium text-fg-primary transition-colors group-hover:text-primary">
                                                {userName || 'Участник'}
                                            </span>
                                            <span className="block truncate text-12-regular text-fg-tertiary transition-colors group-hover:text-fg-secondary">
                                                {line.user?.username
                                                    ? `@${line.user.username}`
                                                    : 'Открыть профиль участника'}
                                            </span>
                                        </span>
                                    </button>
                                    <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                                        <QuantityDisplay
                                            totalQty={Number(line.quantity ?? 0)}
                                            packageCount={Number(line.packageCount ?? 0)}
                                            packAmount={item.packAmount}
                                            unitCode={unitCode}
                                        />
                                        <div className="flex items-center gap-1.5">
                                            {isLast && (
                                                <Badge type="subtle" variant="accent" size="sm">
                                                    последний
                                                </Badge>
                                            )}
                                            {isSupplement && (
                                                <Badge type="subtle" variant="warning" size="sm">
                                                    добор
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-14-semibold tabular-nums text-fg-primary">
                                                {formatRub(Number(line.amountDue ?? 0))}
                                            </p>
                                            <p className="text-12-regular tabular-nums text-fg-tertiary">
                                                {formatDateTime(new Date(line.createdAt))}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Удалить позицию"
                                            title="Удалить позицию"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteLine?.(line);
                                            }}
                                            className="size-8 rounded-full text-fg-tertiary hover:text-error"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-right">
            <p className="text-12-regular text-fg-tertiary">{label}</p>
            <p className="text-14-semibold tabular-nums text-fg-primary">{value}</p>
        </div>
    );
}

function formatQty(value: number, unitCode: string | null | undefined): string {
    return formatQtyUnit(value, resolveUnit(unitCode ?? '')?.shortName ?? '');
}
