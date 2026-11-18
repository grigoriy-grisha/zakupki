import { cn } from '@/lib/utils';

import { LegendDot, pluralize, type PurchaseStatsData, StatsCard } from './shared';

const MAX_CELLS = 10;

function PackCells({ fullPacks, fraction }: { fullPacks: number; fraction: number }) {
    const shownFull = Math.min(fullPacks, fraction > 0 ? MAX_CELLS - 1 : MAX_CELLS);
    const hidden = fullPacks - shownFull;
    return (
        <div className="flex flex-wrap items-center gap-1" aria-hidden>
            {Array.from({ length: shownFull }, (_, i) => (
                <i key={i} className="h-3.5 w-5 rounded-[4px] bg-sage" />
            ))}
            {hidden > 0 && <span className="text-11-medium text-fg-tertiary">+{hidden}</span>}
            {fraction > 0 && (
                <i className="relative h-3.5 w-5 overflow-hidden rounded-[4px] bg-gold/20 ring-1 ring-gold/50 ring-inset">
                    <b
                        className="absolute inset-y-0 left-0 bg-gold"
                        style={{ width: `${Math.round(fraction * 100)}%` }}
                    />
                </i>
            )}
        </div>
    );
}

function formatQty(value: number): string {
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

/** Заполненность упаковок поставщика по весовым позициям, сначала недобранные. */
export function PackFill({ data }: { data: PurchaseStatsData }) {
    const { packs } = data;
    return (
        <StatsCard
            title="Заполненность упаковок"
            meta={
                packs.total > 0
                    ? `недобрано ${packs.partial} из ${packs.total} ${pluralize(packs.total, 'позиции', 'позиций', 'позиций')}`
                    : undefined
            }
        >
            {packs.rows.length === 0 ? (
                <p className="text-14-regular text-fg-tertiary">Нет весовых позиций с размером упаковки</p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-12-regular text-fg-secondary">
                        <span className="inline-flex items-center gap-1.5">
                            <LegendDot color="var(--color-sage)" className="rounded-[3px]" />
                            Набрана целиком
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <LegendDot color="var(--color-gold)" className="rounded-[3px]" />
                            Набрана частично
                        </span>
                    </div>
                    <ul className="flex flex-col divide-y divide-border-low">
                        {packs.rows.map((row) => (
                            <li
                                key={row.itemId}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_7.5rem]"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-14-medium text-fg-primary">{row.name}</div>
                                    <div className="text-12-regular text-fg-tertiary">
                                        упаковка {formatQty(row.packSize)} {row.unit}
                                    </div>
                                </div>
                                <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                                    <PackCells fullPacks={row.fullPacks} fraction={row.fraction} />
                                </div>
                                <div className="text-right">
                                    <div
                                        className={cn(
                                            'text-13-semibold whitespace-nowrap',
                                            row.need > 0
                                                ? 'text-[color-mix(in_srgb,var(--color-gold)_75%,black)]'
                                                : 'text-sage',
                                        )}
                                    >
                                        {row.need > 0 ? `не хватает ${formatQty(row.need)} ${row.unit}` : 'целые'}
                                    </div>
                                    <div className="text-11-regular tabular-nums text-fg-tertiary">
                                        {row.packs.toLocaleString('ru-RU')} упак.
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {packs.total > packs.rows.length && (
                        <p className="text-12-regular text-fg-tertiary">
                            Показаны {packs.rows.length} из {packs.total}. Полный список остатков — во вкладке «Товары».
                        </p>
                    )}
                </>
            )}
        </StatsCard>
    );
}
