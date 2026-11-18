import {
    bucketize,
    buildHistogram,
    classifyParticipantPayment,
    computePackFill,
    computePaymentTotals,
    cumulative,
    DAY_MS,
    HANDOFF_DEFAULT_LABEL,
    HANDOFF_STATUS_LABELS,
    HANDOFF_STATUSES,
    type HandoffStatus,
    isPurchasePaymentOpen,
    isWeightUnit,
    median,
    NotFoundError,
    PARTICIPANT_PAYMENT_STATES,
    type ParticipantPaymentState,
    PURCHASE_FULFILLMENT_STATUSES,
    type PurchaseFulfillmentStatus,
    resolveUnit,
    roundMoney,
    startOfMskDay,
    summarizeMoney,
} from '@zakupki/types';

import type { AnalyticsRepository } from '../domain/analytics.repository';
import { priceOrderLine } from '../lib/line-price-info';
import type { PricingSettingsService } from './settings/pricing-settings';

type StatsScopeKind = 'purchase' | 'all';
type StatsPurchase = NonNullable<Awaited<ReturnType<AnalyticsRepository['findPurchaseForStats']>>>;

/** Дольше этого срока нарастающий итог строится по неделям, чтобы график не превращался в гребёнку. */
const DAILY_TIMELINE_MAX_DAYS = 120;
const TOP_DEBTORS = 8;
const PACKS_LIMIT = 12;

const sum = (values: readonly number[]): number => roundMoney(values.reduce((acc, v) => acc + v, 0));

function stageIndex(status: PurchaseFulfillmentStatus): number {
    return PURCHASE_FULFILLMENT_STATUSES.indexOf(status);
}

function displayName(user: { firstName: string; lastName: string | null } | undefined): string {
    if (!user) return 'Участник';
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

export class PurchaseAnalyticsService {
    constructor(
        private readonly repo: AnalyticsRepository,
        private readonly pricingSettings: PricingSettingsService,
    ) {}

    /** Статистика одной закупки — вкладка «Статистика» на странице закупки. */
    async purchase(purchaseId: number, now: Date = new Date()) {
        const purchase = await this.repo.findPurchaseForStats(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка не найдена');
        return this.build('purchase', [purchase], now);
    }

    /** Общая статистика по всем закупкам (кроме черновиков) — вкладка «Статистика» в сводке. */
    async all(now: Date = new Date()) {
        return this.build('all', await this.repo.findAllPurchasesForStats(), now);
    }

    private async build(kind: StatsScopeKind, purchases: StatsPurchase[], now: Date) {
        const ids = purchases.map((p) => p.id);
        const single = kind === 'purchase' ? purchases[0] : undefined;

        const [lines, payments, allHandoffs, newcomers, orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.repo.findPurchaseLines(ids),
            this.repo.findPurchasePayments(ids),
            this.repo.findPurchaseHandoffs(ids),
            single ? this.repo.countNewcomers(single.id) : Promise.resolve(null),
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);

        const stage = new Map(
            purchases.map((p) => {
                const status = p.fulfillmentStatus;
                return [
                    p.id,
                    {
                        status,
                        paymentOpen: isPurchasePaymentOpen(status),
                        handoffOpen: stageIndex(status) >= stageIndex('PACKAGING'),
                    },
                ] as const;
            }),
        );
        const paymentOpenFor = (purchaseId: number) => stage.get(purchaseId)?.paymentOpen ?? false;
        const paymentOpen = purchases.some((p) => paymentOpenFor(p.id));
        const handoffOpen = purchases.some((p) => stage.get(p.id)?.handoffOpen);
        // В общей статистике выдачу считаем только там, где она уже началась.
        const handoffs = single ? allHandoffs : allHandoffs.filter((h) => stage.get(h.purchaseId)?.handoffOpen);

        // ── Строки: расшифровка суммы ────────────────────────────────
        const pricedLines = lines.map((line) => {
            const { info, breakdown } = priceOrderLine(line, orgFeeDefaultPercent, packDiscountPercent);
            return { line, amountDue: Number(line.amountDue), breakdown, rateToRub: info?.rateToRub ?? null };
        });

        // ── Участники и оплаты ───────────────────────────────────────
        // Участие = участник в конкретной закупке: долг и статус оплаты считаются по каждой закупке отдельно.
        const key = (purchaseId: number, userId: number) => `${purchaseId}:${userId}`;
        const dueByKey = new Map<string, { purchaseId: number; userId: number; due: number }>();
        for (const { line, amountDue } of pricedLines) {
            const k = key(line.purchaseItem.purchaseId, line.userId);
            const entry = dueByKey.get(k) ?? { purchaseId: line.purchaseItem.purchaseId, userId: line.userId, due: 0 };
            entry.due += amountDue;
            dueByKey.set(k, entry);
        }
        const paymentsByKey = new Map<string, { status: string; total: number }[]>();
        for (const payment of payments) {
            const total = Number(payment.amount) + payment.children.reduce((acc, c) => acc + Number(c.amount), 0);
            const k = key(payment.purchaseId, payment.userId);
            const list = paymentsByKey.get(k) ?? [];
            list.push({ status: payment.status, total });
            paymentsByKey.set(k, list);
        }

        const states: Record<ParticipantPaymentState, number> = {
            paid: 0,
            partial: 0,
            pending: 0,
            awaiting: 0,
            unpaid: 0,
        };
        const participantRows = [...dueByKey.entries()].map(([k, entry]) => {
            const due = roundMoney(entry.due);
            const totals = computePaymentTotals(due, paymentsByKey.get(k) ?? []);
            const state = classifyParticipantPayment(due, totals);
            states[state] += 1;
            return {
                purchaseId: entry.purchaseId,
                userId: entry.userId,
                due,
                confirmed: Math.min(totals.confirmedPaid, due),
                confirmedPaid: totals.confirmedPaid,
                pending: totals.pendingPaid,
                awaiting: totals.awaitingPaid,
                debt: totals.remaining,
                state,
            };
        });
        const uniqueUsers = new Set(participantRows.map((row) => row.userId));

        const confirmedPayments = payments.filter((p) => p.status === 'CONFIRMED');
        const promo = sum(confirmedPayments.flatMap((p) => p.children.map((c) => Number(c.amount))));
        const bankFee = sum(confirmedPayments.map((p) => Number(p.feeAmount ?? 0)));

        // До этапа оплаты платить ещё нельзя — это не долг.
        const debtorRows = participantRows.filter((row) => row.debt > 0 && paymentOpenFor(row.purchaseId));
        const debtByUser = new Map<
            number,
            {
                userId: number;
                debt: number;
                due: number;
                confirmedPaid: number;
                pendingPaid: number;
                awaitingPaid: number;
                purchases: number;
            }
        >();
        for (const row of debtorRows) {
            const entry = debtByUser.get(row.userId) ?? {
                userId: row.userId,
                debt: 0,
                due: 0,
                confirmedPaid: 0,
                pendingPaid: 0,
                awaitingPaid: 0,
                purchases: 0,
            };
            entry.debt += row.debt;
            entry.due += row.due;
            entry.confirmedPaid += row.confirmedPaid;
            entry.pendingPaid += row.pending;
            entry.awaitingPaid += row.awaiting;
            entry.purchases += 1;
            debtByUser.set(row.userId, entry);
        }
        const topDebtorRows = [...debtByUser.values()].sort((a, b) => b.debt - a.debt).slice(0, TOP_DEBTORS);
        const users = new Map(
            (await this.repo.findUsersBrief(topDebtorRows.map((row) => row.userId))).map((u) => [u.id, u]),
        );

        // ── Нарастающий итог ─────────────────────────────────────────
        const firstActivity = [...purchases.map((p) => p.createdAt), ...lines.map((l) => l.createdAt)].reduce(
            (min, d) => (d < min ? d : min),
            now,
        );
        const from = startOfMskDay(firstActivity);
        const end = new Date(startOfMskDay(now).getTime() + DAY_MS);
        const days = Math.max(1, Math.round((end.getTime() - from.getTime()) / DAY_MS));
        const bucketMs = days > DAILY_TIMELINE_MAX_DAYS ? 7 * DAY_MS : DAY_MS;
        const window = { from, bucketMs, bucketCount: Math.max(2, Math.ceil(days / (bucketMs / DAY_MS))) };

        const paidAt = (p: (typeof payments)[number]) => p.paidAt ?? p.submittedAt;
        const ordersSeries = cumulative(
            bucketize(
                window,
                pricedLines,
                (r) => r.line.createdAt,
                (r) => r.amountDue,
            ),
        );
        const paidSeries = cumulative(
            bucketize(
                window,
                confirmedPayments,
                paidAt,
                (p) => Number(p.amount) + p.children.reduce((acc, c) => acc + Number(c.amount), 0),
            ),
        );
        const markAt = (date: Date | undefined) =>
            date ? Math.min(window.bucketCount - 1, Math.floor((date.getTime() - from.getTime()) / bucketMs)) : null;
        const firstSupplement = lines
            .filter((l) => l.createdOnStage !== 'COLLECTION')
            .reduce<Date | undefined>((min, l) => (!min || l.createdAt < min ? l.createdAt : min), undefined);
        // Брошенные ссылки и отклонённые оплаты — не оплата; возвраты тоже не считаем.
        const firstPayment = payments
            .filter((p) => (p.status === 'CONFIRMED' || p.status === 'PENDING') && p.refundOfId == null)
            .map((p) => p.submittedAt)
            .reduce<Date | undefined>((min, d) => (!min || d < min ? d : min), undefined);
        const marks = (
            single
                ? [
                      { label: 'первый добор', index: markAt(firstSupplement) },
                      { label: 'первая оплата', index: markAt(firstPayment) },
                  ]
                : []
        ).filter((m): m is { label: string; index: number } => m.index != null);

        // ── Упаковки ─────────────────────────────────────────────────
        const items = new Map<
            number,
            { itemId: number; name: string; unit: string; packSize: number | null; collected: number; weight: boolean }
        >();
        for (const { line } of pricedLines) {
            const item = line.purchaseItem;
            const unitCode = item.unitCode ?? item.product.unitCode;
            const packSize = item.packAmount != null ? Number(item.packAmount) : null;
            const entry = items.get(item.id) ?? {
                itemId: item.id,
                name: item.product.name,
                unit: resolveUnit(unitCode)?.shortName ?? '',
                packSize,
                collected: 0,
                weight: isWeightUnit(unitCode),
            };
            entry.collected += Number(line.quantity) + Number(line.packageCount ?? 0) * (packSize ?? 0);
            items.set(item.id, entry);
        }
        // Остатки упаковок имеют смысл только внутри одной закупки.
        const packRows = [...items.values()]
            .filter((item) => single && item.weight && item.packSize)
            .flatMap((item) => {
                const fill = computePackFill(item.collected, item.packSize ?? 0);
                return fill
                    ? [{ itemId: item.itemId, name: item.name, unit: item.unit, packSize: item.packSize ?? 0, ...fill }]
                    : [];
            })
            // Сначала недобранные (меньше всего заполнены), потом целые.
            .sort((a, b) =>
                (a.fraction === 0) === (b.fraction === 0) ? a.fraction - b.fraction : a.fraction === 0 ? 1 : -1,
            );

        // ── Поставщики ───────────────────────────────────────────────
        const currencyById = new Map(
            purchases.flatMap((p) => p.currencyRates.map((r) => [r.currencyId, r.currency] as const)),
        );
        const suppliers = new Map<string, { name: string; rub: number; currency: Map<string, number> }>();
        for (const { line, breakdown, rateToRub } of pricedLines) {
            if (!breakdown) continue;
            const name = line.purchaseItem.supplier?.name ?? 'Без поставщика';
            const entry = suppliers.get(name) ?? { name, rub: 0, currency: new Map<string, number>() };
            entry.rub += breakdown.baseRub;
            const currency =
                line.purchaseItem.currencyId != null ? currencyById.get(line.purchaseItem.currencyId) : null;
            if (currency && rateToRub) {
                const key = currency.symbol ?? currency.code ?? currency.name;
                entry.currency.set(key, (entry.currency.get(key) ?? 0) + breakdown.baseRub / rateToRub);
            }
            suppliers.set(name, entry);
        }

        // ── Участники ────────────────────────────────────────────────
        const dues = participantRows.map((row) => row.due);
        const supplementLines = pricedLines.filter((r) => r.line.createdOnStage !== 'COLLECTION');

        // ── Выдача ───────────────────────────────────────────────────
        const handoffCounts = new Map<HandoffStatus | 'WAITING', number>();
        for (const order of handoffs) {
            const key = (order.handoffStatus as HandoffStatus | null) ?? 'WAITING';
            handoffCounts.set(key, (handoffCounts.get(key) ?? 0) + 1);
        }
        const handedOff = (['SENT', 'RECEIVED', 'STORED'] as const).reduce(
            (acc, s) => acc + (handoffCounts.get(s) ?? 0),
            0,
        );

        const due = sum(dues);
        const confirmed = sum(participantRows.map((row) => row.confirmed));

        // ── Сравнение закупок (только в общей статистике) ────────────
        const groupBy = <T>(list: readonly T[], purchaseIdOf: (item: T) => number) => {
            const map = new Map<number, T[]>();
            for (const item of list) {
                const id = purchaseIdOf(item);
                const bucket = map.get(id);
                if (bucket) bucket.push(item);
                else map.set(id, [item]);
            }
            return map;
        };
        const rowsByPurchase = single ? null : groupBy(participantRows, (row) => row.purchaseId);
        const linesByPurchase = single ? null : groupBy(pricedLines, (r) => r.line.purchaseItem.purchaseId);
        const confirmedByPurchase = single ? null : groupBy(confirmedPayments, (pay) => pay.purchaseId);
        const byPurchase = single
            ? []
            : purchases.map((p) => {
                  const rows = rowsByPurchase?.get(p.id) ?? [];
                  const open = paymentOpenFor(p.id);
                  const pPromo = sum(
                      (confirmedByPurchase?.get(p.id) ?? []).flatMap((pay) =>
                          pay.children.map((c) => Number(c.amount)),
                      ),
                  );
                  return {
                      id: p.id,
                      tag: p.tag,
                      status: p.status,
                      fulfillmentStatus: p.fulfillmentStatus,
                      createdAt: p.createdAt,
                      paymentOpen: open,
                      participants: rows.length,
                      orders: sum(rows.map((row) => row.due)),
                      confirmed: sum(rows.map((row) => row.confirmed)),
                      debt: open ? sum(rows.map((row) => row.debt)) : 0,
                      orgFee: summarizeMoney(linesByPurchase?.get(p.id) ?? [], pPromo).orgFee,
                  };
              });

        const purchasesPerUser = new Map<number, number>();
        for (const row of participantRows)
            purchasesPerUser.set(row.userId, (purchasesPerUser.get(row.userId) ?? 0) + 1);
        const repeatClients = [...purchasesPerUser.values()].filter((n) => n > 1).length;

        return {
            scope: {
                kind,
                purchaseId: single?.id ?? null,
                fulfillmentStatus: single ? single.fulfillmentStatus : null,
                purchases: purchases.length,
                finished: purchases.filter((p) => p.status === 'DONE').length,
            },
            totals: {
                orders: due,
                lines: lines.length,
                items: items.size,
                participants: uniqueUsers.size,
                participations: participantRows.length,
            },
            payments: {
                open: paymentOpen,
                due,
                confirmed,
                pending: sum(participantRows.map((row) => row.pending)),
                awaiting: sum(participantRows.map((row) => row.awaiting)),
                debt: sum(debtorRows.map((row) => row.debt)),
                debtors: debtByUser.size,
                states: PARTICIPANT_PAYMENT_STATES.map((state) => ({ state, count: states[state] })),
            },
            debtors: topDebtorRows.map((row) => {
                const user = users.get(row.userId);
                return {
                    userId: row.userId,
                    name: displayName(user),
                    username: user?.username ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                    debt: roundMoney(row.debt),
                    due: roundMoney(row.due),
                    purchases: row.purchases,
                    state: classifyParticipantPayment(roundMoney(row.due), row),
                };
            }),
            money: { ...summarizeMoney(pricedLines, promo), bankFee },
            timeline: {
                from,
                bucketMs,
                bucketCount: window.bucketCount,
                orders: ordersSeries,
                paid: paidSeries,
                marks,
            },
            packs: {
                rows: packRows.slice(0, PACKS_LIMIT),
                total: packRows.length,
                partial: packRows.filter((row) => row.fraction > 0).length,
            },
            suppliers: [...suppliers.values()]
                .map((s) => ({
                    name: s.name,
                    rub: roundMoney(s.rub),
                    currency: [...s.currency.entries()].map(([symbol, amount]) => ({
                        symbol,
                        amount: roundMoney(amount),
                    })),
                }))
                .sort((a, b) => b.rub - a.rub),
            rates: (single?.currencyRates ?? []).map((r) => ({
                symbol: r.currency.symbol ?? r.currency.code ?? r.currency.name,
                rate: Number(r.rateToRub),
            })),
            participants: {
                count: participantRows.length,
                average: participantRows.length > 0 ? roundMoney(due / participantRows.length) : 0,
                median: median(dues),
                histogram: buildHistogram(dues),
                newcomers,
                repeatClients,
                uniqueClients: uniqueUsers.size,
            },
            supplements: {
                lines: supplementLines.length,
                users: new Set(supplementLines.map((r) => key(r.line.purchaseItem.purchaseId, r.line.userId))).size,
                amount: sum(supplementLines.map((r) => r.amountDue)),
            },
            byPurchase,
            handoff: {
                open: handoffOpen,
                total: handoffs.length,
                handedOff,
                steps: [
                    {
                        status: 'WAITING' as const,
                        label: HANDOFF_DEFAULT_LABEL,
                        count: handoffCounts.get('WAITING') ?? 0,
                    },
                    ...HANDOFF_STATUSES.map((s) => ({
                        status: s,
                        label: HANDOFF_STATUS_LABELS[s],
                        count: handoffCounts.get(s) ?? 0,
                    })),
                ],
            },
        };
    }
}
