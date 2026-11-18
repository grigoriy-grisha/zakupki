import { Callout, type PurchaseStatsData, rub, StatsCard } from './shared';

function formatCurrency(amount: number, symbol: string): string {
    return `${symbol} ${Math.round(amount).toLocaleString('ru-RU')}`;
}

/** Себестоимость по поставщикам: в рублях и в валюте закупки. */
export function SuppliersCard({ data }: { data: PurchaseStatsData }) {
    const { suppliers, rates } = data;
    const max = Math.max(1, ...suppliers.map((s) => s.rub));
    return (
        <StatsCard title="Поставщики" meta="себестоимость, в валюте и по курсу">
            {suppliers.length === 0 ? (
                <p className="text-14-regular text-fg-tertiary">Нет заказов с ценой</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {suppliers.map((supplier) => (
                        <li key={supplier.name} className="flex flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 truncate text-14-medium text-fg-primary">{supplier.name}</span>
                                <span className="text-14-medium tabular-nums whitespace-nowrap text-fg-primary">
                                    {rub(supplier.rub)}
                                </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-border-low">
                                <div
                                    className="h-full rounded-full bg-secondary"
                                    style={{ width: `${(supplier.rub / max) * 100}%` }}
                                />
                            </div>
                            {supplier.currency.length > 0 && (
                                <span className="text-12-regular tabular-nums text-fg-tertiary">
                                    {supplier.currency.map((c) => formatCurrency(c.amount, c.symbol)).join(' · ')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {rates.length > 0 && (
                <Callout>
                    Курс закупки:{' '}
                    {rates.map((r, i) => (
                        <span key={r.symbol}>
                            {i > 0 && ', '}
                            <b className="text-fg-primary">
                                1 {r.symbol} = {r.rate.toLocaleString('ru-RU', { maximumFractionDigits: 4 })} ₽
                            </b>
                        </span>
                    ))}
                </Callout>
            )}
        </StatsCard>
    );
}
