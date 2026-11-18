import type { PaymentTotals } from '../payment-summary';
import { roundMoney } from '../pricing/currency-pricing';

// ── Распределение чеков ─────────────────────────────────────────────

/** Границы корзин гистограммы чеков, ₽. Последняя корзина — «и больше». */
const CHECK_HISTOGRAM_EDGES = [1000, 2000, 4000, 6000, 10000, 20000] as const;

export type HistogramBin = { label: string; from: number; to: number | null; count: number };

function thousands(value: number): string {
    return (value / 1000).toLocaleString('ru-RU');
}

/** Гистограмма по фиксированным границам; подписи в тысячах рублей («до 1», «1–2», …, «20+»). */
export function buildHistogram(
    values: readonly number[],
    edges: readonly number[] = CHECK_HISTOGRAM_EDGES,
): HistogramBin[] {
    const bins: HistogramBin[] = [];
    let from = 0;
    for (const edge of edges) {
        bins.push({
            label: from === 0 ? `до ${thousands(edge)}` : `${thousands(from)}–${thousands(edge)}`,
            from,
            to: edge,
            count: 0,
        });
        from = edge;
    }
    bins.push({ label: `${thousands(from)}+`, from, to: null, count: 0 });

    for (const value of values) {
        const bin = bins.find((b) => b.to == null || value < b.to);
        if (bin) bin.count += 1;
    }
    return bins;
}

export function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return Math.round(value * 100) / 100;
}

// ── Оплата участника ────────────────────────────────────────────────

export const PARTICIPANT_PAYMENT_STATES = ['paid', 'partial', 'pending', 'awaiting', 'unpaid'] as const;
export type ParticipantPaymentState = (typeof PARTICIPANT_PAYMENT_STATES)[number];

export const PARTICIPANT_PAYMENT_STATE_LABELS: Record<ParticipantPaymentState, string> = {
    paid: 'Оплатили полностью',
    partial: 'Частично',
    pending: 'Чек на проверке',
    awaiting: 'Ждёт онлайн-оплаты',
    unpaid: 'Не платили',
};

const MONEY_EPS = 0.01;

/**
 * Состояние оплаты одного участника. Неполная оплата с чеком на проверке
 * считается «на проверке»: от участника уже ничего не ждём, ждём организатора.
 */
export function classifyParticipantPayment(
    due: number,
    totals: Pick<PaymentTotals, 'confirmedPaid' | 'pendingPaid' | 'awaitingPaid'>,
): ParticipantPaymentState {
    if (totals.confirmedPaid >= due - MONEY_EPS) return 'paid';
    if (totals.pendingPaid > 0) return 'pending';
    if (totals.awaitingPaid > 0) return 'awaiting';
    if (totals.confirmedPaid > 0) return 'partial';
    return 'unpaid';
}

// ── Упаковки поставщика ─────────────────────────────────────────────

export type PackFill = {
    /** Сколько упаковок набрано, дробно (2,7 = две целых и 70% третьей). */
    packs: number;
    fullPacks: number;
    /** Доля последней неполной упаковки, 0…1 (0 — все целые). */
    fraction: number;
    /** Сколько единиц не хватает до целой упаковки. */
    need: number;
};

/** Заполненность упаковок: собранное количество ÷ размер упаковки. Совпадает с авто-остатком добора. */
export function computePackFill(collected: number, packSize: number): PackFill | null {
    if (!(packSize > 0) || !(collected > 0)) return null;
    const packs = collected / packSize;
    const fullPacks = Math.floor(packs + 1e-9);
    const rawFraction = packs - fullPacks;
    const fraction = rawFraction < 1e-6 ? 0 : rawFraction;
    const need = fraction === 0 ? 0 : Math.round((1 - fraction) * packSize * 1000) / 1000;
    return { packs: Math.round(packs * 100) / 100, fullPacks, fraction: Math.round(fraction * 100) / 100, need };
}

// ── Куда идут деньги ────────────────────────────────────────────────

export type MoneyLine = {
    amountDue: number;
    /** Расшифровка строки; null — у позиции не задана цена или курс. */
    breakdown: { baseRub: number; deliveryRub: number; orgFeeRub: number } | null;
};

export type MoneyBreakdown = {
    /** Сумма заказов участников. */
    orders: number;
    supplier: number;
    delivery: number;
    /** Оргсбор после скидок по промокодам. */
    orgFee: number;
    promo: number;
    /** Строки без цены/курса — не разложить. */
    unpriced: number;
};

/**
 * Разбивка суммы заказов: поставщику + доставка + оргсбор + скидки + без расшифровки = заказы.
 * Скидки по промокодам уменьшают оргсбор: оплату поставщику организатор не уменьшает.
 */
export function summarizeMoney(lines: readonly MoneyLine[], promo: number): MoneyBreakdown {
    let orders = 0;
    let supplier = 0;
    let delivery = 0;
    let orgFeeGross = 0;
    let unpriced = 0;
    for (const line of lines) {
        orders += line.amountDue;
        if (line.breakdown) {
            supplier += line.breakdown.baseRub;
            delivery += line.breakdown.deliveryRub;
            orgFeeGross += line.breakdown.orgFeeRub;
        } else {
            unpriced += line.amountDue;
        }
    }
    const appliedPromo = Math.max(0, promo);
    return {
        orders: roundMoney(orders),
        supplier: roundMoney(supplier),
        delivery: roundMoney(delivery),
        orgFee: roundMoney(orgFeeGross - appliedPromo),
        promo: roundMoney(appliedPromo),
        unpriced: roundMoney(unpriced),
    };
}

/** Нарастающий итог по корзинам. */
export function cumulative(values: readonly number[]): number[] {
    let acc = 0;
    return values.map((value) => {
        acc += value;
        return Math.round(acc * 100) / 100;
    });
}
