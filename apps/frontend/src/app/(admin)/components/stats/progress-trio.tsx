import { pluralize, type PurchaseStatsData, rub } from './shared';

function Ring({ value, color, label }: { value: number; color: string; label: string }) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(1, value));
    return (
        <svg viewBox="0 0 76 76" className="size-[72px] shrink-0" aria-hidden>
            <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--color-border-low)" strokeWidth="8" />
            {clamped > 0 && (
                <circle
                    cx="38"
                    cy="38"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - clamped)}
                    transform="rotate(-90 38 38)"
                />
            )}
            <text
                x="38"
                y="43"
                textAnchor="middle"
                className="fill-fg-primary"
                style={{ font: '600 14px var(--font-sans, inherit)' }}
            >
                {label}
            </text>
        </svg>
    );
}

function RingCard({
    title,
    value,
    hint,
    progress,
    color,
    ringLabel,
}: {
    title: string;
    value: string;
    hint: string;
    progress: number;
    color: string;
    ringLabel: string;
}) {
    return (
        <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-bg-soft p-4">
            <Ring value={progress} color={color} label={ringLabel} />
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-13-medium text-fg-secondary">{title}</span>
                <span className="truncate text-20-semibold tabular-nums text-fg-primary">{value}</span>
                <span className="text-12-regular text-fg-tertiary">{hint}</span>
            </div>
        </div>
    );
}

/** Три кольца: собрано, оплачено, выдано. */
export function ProgressTrio({ data }: { data: PurchaseStatsData }) {
    const { totals, payments, handoff, scope } = data;
    const paidShare = payments.due > 0 ? payments.confirmed / payments.due : 0;
    const handedShare = handoff.total > 0 ? handoff.handedOff / handoff.total : 0;
    const overall = scope.kind === 'all';
    const collectionClosed = scope.fulfillmentStatus !== 'COLLECTION';
    const collectProgress = overall
        ? scope.purchases > 0
            ? scope.finished / scope.purchases
            : 0
        : collectionClosed
          ? 1
          : 0.5;
    const collectRing = overall ? `${scope.finished}/${scope.purchases}` : collectionClosed ? '✓' : 'идёт';
    const participantsText = `${totals.participants} ${pluralize(totals.participants, 'участник', 'участника', 'участников')}`;
    const collectHint = overall
        ? `${scope.purchases} ${pluralize(scope.purchases, 'закупка', 'закупки', 'закупок')}, завершено ${scope.finished} · ${participantsText}`
        : `${totals.items} ${pluralize(totals.items, 'позиция', 'позиции', 'позиций')} · ${participantsText}`;

    const waiting = payments.pending + payments.awaiting;
    const paidHint = !payments.open
        ? 'оплата откроется на этапе «Оплата»'
        : [`долг ${rub(payments.debt)}`, waiting > 0 ? `ждёт проверки ${rub(waiting)}` : null]
              .filter(Boolean)
              .join(' · ');

    return (
        <div className="grid gap-3 md:grid-cols-3">
            <RingCard
                title="Собрано заказов"
                value={rub(totals.orders)}
                hint={collectHint}
                progress={collectProgress}
                color="var(--color-secondary)"
                ringLabel={collectRing}
            />
            <RingCard
                title="Оплачено"
                value={rub(payments.confirmed)}
                hint={paidHint}
                progress={paidShare}
                color="var(--color-gold)"
                ringLabel={`${Math.round(paidShare * 100)}%`}
            />
            <RingCard
                title="Выдано"
                value={`${handoff.handedOff} из ${handoff.total}`}
                hint={
                    handoff.open
                        ? overall
                            ? 'в закупках, где уже идёт выдача'
                            : 'отправлено, получено или на хранении'
                        : 'выдача начнётся с этапа «Фасовка»'
                }
                progress={handedShare}
                color="var(--color-sage)"
                ringLabel={`${Math.round(handedShare * 100)}%`}
            />
        </div>
    );
}
