import {
    type AnalyticsPeriod,
    bucketize,
    computeDelta,
    DAY_MS,
    isPurchasePaymentOpen,
    type MetricDelta,
    PURCHASE_FULFILLMENT_STATUSES,
    type ResolvedPeriod,
    resolvePeriod,
    roundMoney,
    startOfMskDay,
    summarizePurchaseDebts,
} from '@zakupki/types';

import type { AnalyticsRepository } from '../domain/analytics.repository';
import { priceOrderLine } from '../lib/line-price-info';
import type { PricingSettingsService } from './settings/pricing-settings';

export type AnalyticsMetric = {
    value: number;
    previous: number;
    delta: MetricDelta;
    series: number[];
};

const RECENT_ORDERS_DAYS = 14;
const STALE_ONLINE_PAYMENT_MS = 60 * 60 * 1000;

const sum = (values: readonly number[]): number => roundMoney(values.reduce((acc, v) => acc + v, 0));

function metric(current: number[], previous: number[]): AnalyticsMetric {
    const value = sum(current);
    const prev = sum(previous);
    return { value, previous: prev, delta: computeDelta(value, prev), series: current };
}

/** Тот же период, сдвинутый назад на свою длину. */
function previousOf(resolved: ResolvedPeriod): ResolvedPeriod {
    return { ...resolved, from: resolved.prevFrom, to: resolved.prevTo };
}

export class AnalyticsService {
    constructor(
        private readonly repo: AnalyticsRepository,
        private readonly pricingSettings: PricingSettingsService,
    ) {}

    /** Главные цифры за период и за предыдущий период такой же длины. */
    async overview(period: AnalyticsPeriod, now: Date = new Date()) {
        const current = resolvePeriod(period, now);
        const previous = previousOf(current);
        const range = { from: current.prevFrom, to: current.to };

        const [lines, payments, clients, orgFeeDefaultPercent, packDiscountPercent] = await Promise.all([
            this.repo.findOrderLinesCreated(range),
            this.repo.findConfirmedPayments(range),
            this.repo.findClientsCreated(range),
            this.pricingSettings.getOrgFeeDefaultPercent(),
            this.pricingSettings.getBeadPackPriceDiscountPercent(),
        ]);

        const orders = lines.map((line) => {
            const { breakdown } = priceOrderLine(line, orgFeeDefaultPercent, packDiscountPercent);
            return {
                at: line.createdAt,
                userId: line.userId,
                amount: Number(line.amountDue),
                orgFee: breakdown?.orgFeeRub ?? 0,
            };
        });

        const paid = payments.map((payment) => ({
            at: payment.paidAt ?? payment.submittedAt,
            amount: Number(payment.amount),
            // Скидка по промокоду оплачивается из оргсбора организатора.
            discount: payment.children.reduce((acc, child) => acc + Number(child.amount), 0),
        }));

        const both = <T>(rows: T[], at: (row: T) => Date, value?: (row: T) => number) => ({
            current: bucketize(current, rows, at, value),
            previous: bucketize(previous, rows, at, value),
        });

        const turnover = both(
            orders,
            (o) => o.at,
            (o) => o.amount,
        );
        const received = both(
            paid,
            (p) => p.at,
            (p) => p.amount,
        );
        const orgFee = both(
            orders,
            (o) => o.at,
            (o) => o.orgFee,
        );
        const discounts = both(
            paid,
            (p) => p.at,
            (p) => p.discount,
        );
        const newClients = both(clients, (c) => c.createdAt);

        const netOrgFee = (fees: number[], disc: number[]) => fees.map((fee, i) => roundMoney(fee - disc[i]));

        return {
            period,
            from: current.from,
            to: current.to,
            bucketMs: current.bucketMs,
            turnover: metric(turnover.current, turnover.previous),
            received: metric(received.current, received.previous),
            orgFee: metric(
                netOrgFee(orgFee.current, discounts.current),
                netOrgFee(orgFee.previous, discounts.previous),
            ),
            newClients: metric(newClients.current, newClients.previous),
            avgCheck: this.averageCheck(orders, current, previous),
        };
    }

    /** Текущее состояние: что требует внимания, этапы и активные закупки. */
    async snapshot(now: Date = new Date()) {
        const purchases = await this.repo.findOpenPurchases();
        const ids = purchases.map((p) => p.id);
        const recentFrom = new Date(startOfMskDay(now).getTime() - (RECENT_ORDERS_DAYS - 1) * DAY_MS);

        const [dues, payments, recent, pendingManual, staleOnline, handoff] = await Promise.all([
            this.repo.findParticipantDues(ids),
            this.repo.findParticipantPayments(ids),
            this.repo.findRecentOrderAmounts(ids, recentFrom),
            this.repo.countPendingManualPayments(),
            this.repo.countStaleOnlinePayments(new Date(now.getTime() - STALE_ONLINE_PAYMENT_MS)),
            this.repo.countOrdersAwaitingHandoff(),
        ]);

        const debts = summarizePurchaseDebts(dues, payments);
        const recentWindow = { from: recentFrom, bucketMs: DAY_MS, bucketCount: RECENT_ORDERS_DAYS };

        const recentByPurchase = new Map<number, typeof recent>();
        for (const r of recent) {
            const bucket = recentByPurchase.get(r.purchaseId);
            if (bucket) bucket.push(r);
            else recentByPurchase.set(r.purchaseId, [r]);
        }

        const rows = purchases.map((purchase) => {
            const status = purchase.fulfillmentStatus;
            const paymentOpen = isPurchasePaymentOpen(status);
            const debt = debts.get(purchase.id);
            return {
                id: purchase.id,
                tag: purchase.tag,
                fulfillmentStatus: status,
                paymentOpen,
                participants: debt?.participants ?? 0,
                due: debt?.due ?? 0,
                confirmed: debt?.confirmed ?? 0,
                pending: debt?.pending ?? 0,
                awaiting: debt?.awaiting ?? 0,
                // До этапа оплаты платить ещё нельзя — это не долг.
                debt: paymentOpen ? (debt?.debt ?? 0) : 0,
                debtors: paymentOpen ? (debt?.debtors ?? 0) : 0,
                recentOrders: bucketize(
                    recentWindow,
                    recentByPurchase.get(purchase.id) ?? [],
                    (r) => r.createdAt,
                    (r) => r.amount,
                ),
            };
        });

        const stages = PURCHASE_FULFILLMENT_STATUSES.map((status) => {
            const inStage = rows.filter((row) => row.fulfillmentStatus === status);
            return { status, purchases: inStage.length, due: sum(inStage.map((row) => row.due)) };
        });

        const debtRows = rows.filter((row) => row.debt > 0);
        return {
            purchases: rows,
            stages,
            debt: {
                total: sum(debtRows.map((row) => row.debt)),
                debtors: debtRows.reduce((acc, row) => acc + row.debtors, 0),
                purchases: debtRows.length,
            },
            attention: {
                pendingManual,
                staleOnline,
                awaitingHandoff: handoff,
            },
        };
    }

    /** Оборот на одного участника: сумма заказов ÷ число разных участников. Один проход по строкам. */
    private averageCheck(
        orders: { at: Date; userId: number; amount: number }[],
        current: ResolvedPeriod,
        previous: ResolvedPeriod,
    ): AnalyticsMetric {
        type Acc = { amount: number; users: Set<number> };
        const acc = (): Acc => ({ amount: 0, users: new Set() });
        const buckets = Array.from({ length: current.bucketCount }, acc);
        const totals = { current: acc(), previous: acc() };
        const from = current.from.getTime();

        for (const order of orders) {
            const at = order.at.getTime();
            if (order.at >= current.from && order.at < current.to) {
                totals.current.amount += order.amount;
                totals.current.users.add(order.userId);
                const bucket = buckets[Math.floor((at - from) / current.bucketMs)];
                if (bucket) {
                    bucket.amount += order.amount;
                    bucket.users.add(order.userId);
                }
            } else if (order.at >= previous.from && order.at < previous.to) {
                totals.previous.amount += order.amount;
                totals.previous.users.add(order.userId);
            }
        }

        const average = ({ amount, users }: Acc) => (users.size === 0 ? 0 : roundMoney(amount / users.size));
        const value = average(totals.current);
        const prev = average(totals.previous);
        return { value, previous: prev, delta: computeDelta(value, prev), series: buckets.map(average) };
    }
}
