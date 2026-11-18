import { PARTICIPANT_PAYMENT_STATE_LABELS, type ParticipantPaymentState } from '@zakupki/types';

import { UserAvatar } from '@/components/shared/user-avatar';

import { LegendDot, pluralize, type PurchaseStatsData, rub, StatsCard } from './shared';

const STATE_COLORS: Record<ParticipantPaymentState, string> = {
    paid: 'var(--color-sage)',
    partial: 'var(--color-secondary)',
    pending: 'var(--color-gold)',
    awaiting: 'var(--color-chart-5)',
    unpaid: 'var(--color-primary)',
};

const DEBTOR_STATE_TEXT: Record<ParticipantPaymentState, string> = {
    paid: 'оплатил',
    partial: 'оплатил частично',
    pending: 'ждёт подтверждения',
    awaiting: 'ждёт онлайн-оплаты',
    unpaid: 'не платил',
};

/** Состояние оплат участников и самые крупные долги. */
export function PaymentsCard({ data }: { data: PurchaseStatsData }) {
    const { payments, debtors, totals, scope } = data;
    const overall = scope.kind === 'all';
    const states = payments.states.filter((s) => s.count > 0);

    return (
        <StatsCard
            title="Оплаты"
            meta={
                overall
                    ? `${totals.participations} ${pluralize(totals.participations, 'участие', 'участия', 'участий')} в закупках`
                    : `${totals.participants} ${pluralize(totals.participants, 'участник', 'участника', 'участников')}`
            }
        >
            {states.length > 0 && (
                <>
                    <div
                        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                        role="img"
                        aria-label="Состояние оплат"
                    >
                        {states.map((s) => (
                            <i
                                key={s.state}
                                style={{ flexGrow: s.count, flexBasis: 0, background: STATE_COLORS[s.state] }}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-12-regular text-fg-secondary">
                        {states.map((s) => (
                            <span key={s.state} className="inline-flex items-center gap-1.5">
                                <LegendDot color={STATE_COLORS[s.state]} />
                                {PARTICIPANT_PAYMENT_STATE_LABELS[s.state]} ·{' '}
                                <b className="tabular-nums text-fg-primary">{s.count}</b>
                            </span>
                        ))}
                    </div>
                </>
            )}

            <div className="flex flex-col gap-2">
                <h4 className="text-14-semibold text-fg-primary">
                    Должны больше всех
                    {payments.debtors > 0 && (
                        <span className="ml-2 text-12-regular text-fg-tertiary">
                            всего {payments.debtors} · {rub(payments.debt)}
                        </span>
                    )}
                </h4>
                {!payments.open ? (
                    <p className="text-13-regular text-fg-tertiary">Оплата ещё не открыта — долгов пока нет</p>
                ) : debtors.length === 0 ? (
                    <p className="text-13-regular text-sage">Все участники оплатили</p>
                ) : (
                    <ul className="flex flex-col">
                        {debtors.map((debtor) => (
                            <li key={debtor.userId} className="flex items-center gap-3 py-1.5">
                                <UserAvatar
                                    src={debtor.avatarUrl}
                                    className="size-8 shrink-0 rounded-full ring-1 ring-border-soft"
                                    iconClassName="h-4 w-4"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-14-medium text-fg-primary">{debtor.name}</div>
                                    <div className="truncate text-12-regular text-fg-tertiary">
                                        {debtor.username ? `@${debtor.username} · ` : ''}
                                        {DEBTOR_STATE_TEXT[debtor.state]}
                                        {debtor.purchases > 1 ? ` · в ${debtor.purchases} закупках` : ''}
                                        {debtor.debt < debtor.due ? ` · из ${rub(debtor.due)}` : ''}
                                    </div>
                                </div>
                                <span className="text-14-semibold tabular-nums whitespace-nowrap text-error">
                                    {rub(debtor.debt)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </StatsCard>
    );
}
