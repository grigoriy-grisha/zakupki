import { Callout, LegendDot, percent, type PurchaseStatsData, rub, StatsCard } from './shared';

type Segment = { key: string; label: string; value: number; color: string; hint?: string };

/** Куда идут деньги участников: поставщику, доставка, оргсбор, скидки. */
export function MoneyBreakdown({ data }: { data: PurchaseStatsData }) {
    const { money } = data;
    const segments: Segment[] = [
        { key: 'supplier', label: 'Поставщикам', value: money.supplier, color: 'var(--color-secondary)' },
        { key: 'delivery', label: 'Доставка', value: money.delivery, color: 'var(--color-chart-5)' },
        {
            key: 'orgFee',
            label: 'Оргсбор',
            value: money.orgFee,
            color: 'var(--color-sage)',
            hint: money.promo > 0 ? 'после скидок' : undefined,
        },
        { key: 'promo', label: 'Скидки по промокодам', value: money.promo, color: 'var(--color-gold)' },
        {
            key: 'unpriced',
            label: 'Без расшифровки',
            value: money.unpriced,
            color: 'var(--color-border-soft)',
            hint: 'нет цены или курса',
        },
    ].filter((segment) => segment.value > 0);

    return (
        <StatsCard title="Куда идут деньги" meta={`из ${rub(money.orders)} заказов участников`}>
            {money.orders > 0 ? (
                <>
                    <div
                        className="flex h-9 w-full overflow-hidden rounded-xl"
                        role="img"
                        aria-label="Разбивка суммы заказов"
                    >
                        {segments.map((segment) => (
                            <div
                                key={segment.key}
                                className="flex min-w-0 items-center justify-center overflow-hidden px-2 text-12-medium whitespace-nowrap text-white"
                                style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color }}
                                title={`${segment.label}: ${rub(segment.value)}`}
                            >
                                {segment.value / money.orders > 0.14 ? segment.label : ''}
                            </div>
                        ))}
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        {segments.map((segment) => (
                            <div key={segment.key} className="flex items-center gap-2 text-14-regular">
                                <LegendDot color={segment.color} />
                                <dt className="min-w-0 flex-1 truncate text-fg-secondary">
                                    {segment.label}
                                    {segment.hint && <span className="ml-1 text-fg-tertiary">· {segment.hint}</span>}
                                </dt>
                                <dd className="text-14-medium tabular-nums text-fg-primary">{rub(segment.value)}</dd>
                                <dd className="w-12 text-right text-12-regular tabular-nums text-fg-tertiary">
                                    {percent(segment.value, money.orders)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <Callout>
                        {money.bankFee > 0 && (
                            <>
                                Сверху клиенты доплатили <b className="text-fg-primary">{rub(money.bankFee)}</b>{' '}
                                комиссии Т-Банка — это не доход, она уходит банку.{' '}
                            </>
                        )}
                        Оргсбор — оценка по проценту позиции. Скидки по промокодам уменьшают оргсбор, а не оплату
                        поставщику.
                    </Callout>
                </>
            ) : (
                <p className="text-14-regular text-fg-tertiary">Заказов пока нет</p>
            )}
        </StatsCard>
    );
}
