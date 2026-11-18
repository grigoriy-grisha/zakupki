import { PURCHASE_FULFILLMENT_LABELS } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';

import { percent, pluralize, type PurchaseStatsData, rub, StatsCard } from './shared';

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Europe/Moscow',
});

/** Все закупки рядом: сколько заказали, оплатили, должны и сколько оргсбора. */
export function PurchasesCompare({ data }: { data: PurchaseStatsData }) {
    const rows = data.byPurchase;
    const max = Math.max(1, ...rows.map((row) => row.orders));
    const total = {
        orders: rows.reduce((acc, row) => acc + row.orders, 0),
        confirmed: rows.reduce((acc, row) => acc + row.confirmed, 0),
        debt: rows.reduce((acc, row) => acc + row.debt, 0),
        orgFee: rows.reduce((acc, row) => acc + row.orgFee, 0),
    };

    return (
        <StatsCard
            title="По закупкам"
            meta={`${rows.length} ${pluralize(rows.length, 'закупка', 'закупки', 'закупок')} · свежие сверху`}
        >
            {rows.length === 0 ? (
                <p className="text-14-regular text-fg-tertiary">Закупок пока нет</p>
            ) : (
                <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
                    <table className="w-full min-w-[720px] text-14-regular">
                        <thead>
                            <tr className="text-left text-12-regular text-fg-tertiary">
                                <th className="pb-2 font-normal">Закупка</th>
                                <th className="pb-2 font-normal">Заказы</th>
                                <th className="pb-2 pl-4 text-right font-normal">Оплачено</th>
                                <th className="pb-2 pl-4 text-right font-normal">Долг</th>
                                <th className="pb-2 pl-4 text-right font-normal">Оргсбор</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-low">
                            {rows.map((row) => (
                                <tr key={row.id} className="align-middle">
                                    <td className="py-2.5 pr-3">
                                        <AppLink
                                            href={`/purchases/${row.id}`}
                                            className="text-14-medium text-fg-primary hover:underline"
                                        >
                                            {row.tag}
                                        </AppLink>
                                        <div className="mt-0.5 flex items-center gap-2 text-12-regular text-fg-tertiary">
                                            <Badge
                                                variant={
                                                    row.status !== 'DONE' && row.paymentOpen ? 'accent' : 'neutral'
                                                }
                                                className="whitespace-nowrap"
                                            >
                                                {row.status === 'DONE'
                                                    ? 'Завершена'
                                                    : PURCHASE_FULFILLMENT_LABELS[row.fulfillmentStatus]}
                                            </Badge>
                                            <span className="whitespace-nowrap">
                                                {DATE_FORMAT.format(new Date(row.createdAt))} · {row.participants} уч.
                                            </span>
                                        </div>
                                    </td>
                                    <td className="w-[30%] py-2.5 pr-3">
                                        <div className="text-14-medium tabular-nums text-fg-primary">
                                            {rub(row.orders)}
                                        </div>
                                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-low">
                                            <div
                                                className="relative h-full rounded-full bg-secondary/35"
                                                style={{ width: `${(row.orders / max) * 100}%` }}
                                            >
                                                <div
                                                    className="absolute inset-y-0 left-0 rounded-full bg-sage"
                                                    style={{
                                                        width: `${row.orders > 0 ? Math.min(100, (row.confirmed / row.orders) * 100) : 0}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap">
                                        <div className="text-fg-primary">{rub(row.confirmed)}</div>
                                        <div className="text-12-regular text-fg-tertiary">
                                            {percent(row.confirmed, row.orders)}
                                        </div>
                                    </td>
                                    <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap">
                                        {row.debt > 0 ? (
                                            <span className="text-error">{rub(row.debt)}</span>
                                        ) : (
                                            <span className="text-fg-disabled">—</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap text-fg-primary">
                                        {rub(row.orgFee)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-border-soft text-14-semibold tabular-nums text-fg-primary">
                                <td className="pt-2.5">Итого</td>
                                <td className="pt-2.5 whitespace-nowrap">{rub(total.orders)}</td>
                                <td className="pt-2.5 pl-4 text-right whitespace-nowrap">{rub(total.confirmed)}</td>
                                <td className="pt-2.5 pl-4 text-right whitespace-nowrap text-error">
                                    {rub(total.debt)}
                                </td>
                                <td className="pt-2.5 pl-4 text-right whitespace-nowrap">{rub(total.orgFee)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </StatsCard>
    );
}
