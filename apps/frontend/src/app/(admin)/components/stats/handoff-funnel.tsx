import { percent, type PurchaseStatsData, StatsCard } from './shared';

const STEP_COLORS = [
    'var(--color-chart-5)',
    'var(--color-gold)',
    'var(--color-secondary)',
    'color-mix(in srgb, var(--color-sage) 70%, white)',
    'var(--color-sage)',
];

/** Воронка выдачи: сколько заказов на каком шаге. */
export function HandoffFunnel({ data }: { data: PurchaseStatsData }) {
    const { handoff } = data;
    const max = Math.max(1, ...handoff.steps.map((s) => s.count));
    return (
        <StatsCard
            title="Выдача"
            meta={
                handoff.open
                    ? `выдано ${handoff.handedOff} из ${handoff.total} · ${percent(handoff.handedOff, handoff.total)}`
                    : 'заработает с этапа «Фасовка»'
            }
        >
            <ul className="flex flex-col gap-2">
                {handoff.steps.map((step, i) => (
                    <li
                        key={step.status}
                        className="grid grid-cols-[9rem_minmax(0,1fr)_2.5rem] items-center gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_3rem]"
                    >
                        <span className="truncate text-13-regular text-fg-secondary">{step.label}</span>
                        <div className="h-5 overflow-hidden rounded-md bg-border-low/60">
                            <div
                                className="h-full rounded-md"
                                style={{
                                    width: step.count ? `${Math.max(2, (step.count / max) * 100)}%` : 0,
                                    background: STEP_COLORS[i % STEP_COLORS.length],
                                    opacity: handoff.open ? 1 : 0.5,
                                }}
                            />
                        </div>
                        <span className="text-right text-14-medium tabular-nums text-fg-primary">{step.count}</span>
                    </li>
                ))}
            </ul>
        </StatsCard>
    );
}
