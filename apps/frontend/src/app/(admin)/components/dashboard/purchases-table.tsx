import { DAY_MS, PURCHASE_FULFILLMENT_LABELS } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { formatRubShort } from './format';
import type { DashboardPurchaseRow } from './types';

function PaidBar({ row }: { row: DashboardPurchaseRow }) {
    if (!row.paymentOpen) {
        return <span className="text-12-regular text-fg-tertiary">оплата ещё не открыта</span>;
    }
    const percent = row.due > 0 ? Math.min(100, (row.confirmed / row.due) * 100) : 0;
    const pendingPercent = row.due > 0 ? Math.min(100 - percent, (row.pending / row.due) * 100) : 0;
    return (
        <div className="flex min-w-32 items-center gap-2">
            <div
                className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle"
                role="img"
                aria-label={`Оплачено ${Math.round(percent)}%`}
            >
                <div className="h-full bg-success" style={{ width: `${percent}%` }} />
                <div className="h-full bg-warning/70" style={{ width: `${pendingPercent}%` }} />
            </div>
            <span className="w-9 text-right text-12-medium tabular-nums text-fg-secondary">{Math.round(percent)}%</span>
        </div>
    );
}

export function PurchasesTable({
    rows,
    recentOrdersFrom,
}: {
    rows: readonly DashboardPurchaseRow[];
    recentOrdersFrom?: Date | string;
}) {
    if (rows.length === 0) {
        return <p className="py-6 text-center text-14-regular text-fg-tertiary">Открытых закупок нет</p>;
    }

    return (
        <div className="-mx-1 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Закупка</TableHead>
                        <TableHead>Этап</TableHead>
                        <TableHead className="text-right">Участники</TableHead>
                        <TableHead className="text-right">К оплате</TableHead>
                        <TableHead>Оплачено</TableHead>
                        <TableHead className="text-right">Долг</TableHead>
                        <TableHead className="w-28">Заказы, 14 дн.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell>
                                <AppLink
                                    href={`/purchases/${row.id}`}
                                    className="font-display text-16-semibold whitespace-nowrap text-secondary hover:underline"
                                >
                                    {row.tag}
                                </AppLink>
                            </TableCell>
                            <TableCell>
                                <Badge variant={row.paymentOpen ? 'accent' : 'neutral'} className="whitespace-nowrap">
                                    {PURCHASE_FULFILLMENT_LABELS[row.fulfillmentStatus]}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.participants}</TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                                {row.due > 0 ? formatRubShort(row.due) : '—'}
                            </TableCell>
                            <TableCell>
                                <PaidBar row={row} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                                {row.debt > 0 ? (
                                    <span className="flex flex-col items-end">
                                        <span className="text-error">{formatRubShort(row.debt)}</span>
                                        <span className="text-11-regular text-fg-tertiary">{row.debtors} чел.</span>
                                    </span>
                                ) : (
                                    <span className="text-fg-tertiary">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <Sparkline
                                    values={row.recentOrders}
                                    color="var(--color-secondary)"
                                    className="h-7 w-24"
                                    // Один вид на всю колонку — иначе строки с редкими заказами
                                    // переключаются на столбики и выглядят как другой график.
                                    variant="bars"
                                    tooltipSide="left"
                                    start={recentOrdersFrom}
                                    bucketMs={DAY_MS}
                                    formatValue={formatRubShort}
                                    valueLabel="Заказано"
                                    aria-label={`Заказы за 14 дней: ${row.tag}`}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function PurchasesTableSkeleton() {
    return (
        <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
    );
}
