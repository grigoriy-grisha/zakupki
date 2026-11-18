import {
    type AnalyticsPeriod,
    bucketIndex,
    bucketize,
    computeDelta,
    DAY_MS,
    detectVisitDevice,
    detectVisitPlatform,
    type ResolvedPeriod,
    resolvePeriod,
    startOfMskDay,
    VISIT_DEVICES,
    VISIT_PLATFORMS,
    type VisitDevice,
    type VisitPlatform,
} from '@zakupki/types';

import type { UserVisitRepository } from '../domain/user-visit.repository';

/** Отмечаем визит не чаще раза в 10 минут на пользователя, площадку и устройство. */
const TRACK_THROTTLE_MS = 10 * 60 * 1000;
/** Клиент «пропал», если не заказывал дольше этого срока. */
const DORMANT_AFTER_DAYS = 60;

const FREQUENCY_BINS = [
    { label: '1 день', from: 1, to: 1 },
    { label: '2–3 дня', from: 2, to: 3 },
    { label: '4–7 дней', from: 4, to: 7 },
    { label: '8–14 дней', from: 8, to: 14 },
    { label: '15+ дней', from: 15, to: Infinity },
];

const PURCHASE_BINS = [
    { label: 'Ни разу', from: 0, to: 0 },
    { label: '1 закупка', from: 1, to: 1 },
    { label: '2 закупки', from: 2, to: 2 },
    { label: '3 закупки', from: 3, to: 3 },
    { label: '4 и больше', from: 4, to: Infinity },
];

type Activity = { userId: number; at: Date };

const globalThrottle = globalThis as unknown as { visitThrottle?: Map<string, number> };
const throttle = (globalThrottle.visitThrottle ??= new Map());
const THROTTLE_MAX_KEYS = 50_000;

/** Убираем только устаревшие отметки: полная очистка разом выпустила бы всех в БД одновременно. */
function pruneThrottle(nowMs: number) {
    for (const [key, at] of throttle) {
        if (nowMs - at >= TRACK_THROTTLE_MS) throttle.delete(key);
    }
}

/** Уникальные пользователи по корзинам периода и за весь период. */
function uniqueUsers(resolved: ResolvedPeriod, rows: readonly Activity[]) {
    const buckets = Array.from({ length: resolved.bucketCount }, () => new Set<number>());
    const all = new Set<number>();
    for (const row of rows) {
        const index = bucketIndex(resolved, row.at);
        if (index < 0) continue;
        buckets[index].add(row.userId);
        all.add(row.userId);
    }
    return { series: buckets.map((set) => set.size), total: all.size, users: all };
}

function inRange(resolved: Pick<ResolvedPeriod, 'from' | 'to'>, at: Date) {
    return at >= resolved.from && at < resolved.to;
}

function binCounts(bins: typeof FREQUENCY_BINS, values: Iterable<number>) {
    const counts = bins.map((bin) => ({ label: bin.label, count: 0 }));
    for (const value of values) {
        const index = bins.findIndex((bin) => value >= bin.from && value <= bin.to);
        if (index >= 0) counts[index].count += 1;
    }
    return counts;
}

export class UserAnalyticsService {
    constructor(private readonly repo: UserVisitRepository) {}

    /** Отметить визит. Не бросает ошибок: статистика не должна ломать запросы. */
    track(userId: number, req: Request | undefined, telegramInitData: boolean, now: Date = new Date()) {
        if (!req) return;
        let pathname: string | null = null;
        try {
            const referer = req.headers.get('referer');
            pathname = referer ? new URL(referer).pathname : null;
        } catch {
            pathname = null;
        }
        const platform = detectVisitPlatform(pathname, telegramInitData);
        const device = detectVisitDevice(req.headers.get('user-agent'));
        const day = startOfMskDay(now);
        const key = `${userId}:${day.getTime()}:${platform}:${device}`;
        const last = throttle.get(key);
        if (last != null && now.getTime() - last < TRACK_THROTTLE_MS) return;
        if (throttle.size > THROTTLE_MAX_KEYS) pruneThrottle(now.getTime());
        throttle.set(key, now.getTime());
        this.repo.touch(userId, day, platform, device).catch(() => throttle.delete(key));
    }

    /** Рост, активность, устройства и частота клиентов за период. */
    async overview(period: AnalyticsPeriod, now: Date = new Date()) {
        const current = resolvePeriod(period, now);
        const previous = { ...current, from: current.prevFrom, to: current.prevTo };
        const range = { from: current.prevFrom, to: current.to };

        const [clients, visits, orderDays, purchaseCounts, trackingSince] = await Promise.all([
            this.repo.findClients(),
            this.repo.findVisits(range),
            this.repo.findOrderDays(range),
            this.repo.findPurchaseCounts(),
            this.repo.firstVisitDay(),
        ]);

        // Рост базы: новые по корзинам и сколько всего на конец каждой корзины.
        const newSeries = bucketize(current, clients, (c) => c.createdAt);
        const newPrevSeries = bucketize(previous, clients, (c) => c.createdAt);
        const newCurrent = newSeries.reduce((a, b) => a + b, 0);
        const newPrevious = newPrevSeries.reduce((a, b) => a + b, 0);
        let running = clients.filter((c) => c.createdAt < current.from).length;
        const totalSeries = newSeries.map((count) => (running += count));

        const sources = { telegram: 0, vk: 0, both: 0, none: 0 };
        for (const client of clients) {
            if (client.tg && client.vk) sources.both += 1;
            else if (client.tg) sources.telegram += 1;
            else if (client.vk) sources.vk += 1;
            else sources.none += 1;
        }

        // Покупатели — по дням, когда что-то заказывали.
        const buyers = uniqueUsers(current, orderDays);
        const buyersPrev = uniqueUsers(previous, orderDays);

        // Визиты — с момента, как включили учёт.
        const visitRows = visits.map((v) => ({ ...v, at: v.day }));
        const visitors = uniqueUsers(current, visitRows);
        const visitorsPrev = uniqueUsers(previous, visitRows);

        const platformUsers = new Map<VisitPlatform, Set<number>>(VISIT_PLATFORMS.map((p) => [p, new Set()]));
        const deviceUsers = new Map<VisitDevice, Set<number>>(VISIT_DEVICES.map((d) => [d, new Set()]));
        const visitDays = new Map<number, Set<number>>();
        for (const visit of visits) {
            if (!inRange(current, visit.day)) continue;
            platformUsers.get(visit.platform)?.add(visit.userId);
            deviceUsers.get(visit.device)?.add(visit.userId);
            const days = visitDays.get(visit.userId) ?? new Set<number>();
            days.add(visit.day.getTime());
            visitDays.set(visit.userId, days);
        }

        const orderDaysByUser = new Map<number, number>();
        for (const row of orderDays) {
            if (inRange(current, row.at)) orderDaysByUser.set(row.userId, (orderDaysByUser.get(row.userId) ?? 0) + 1);
        }

        const ordered = new Map(purchaseCounts.map((row) => [row.userId, row]));
        const dormantBefore = new Date(now.getTime() - DORMANT_AFTER_DAYS * DAY_MS);
        const dormant = purchaseCounts.filter((row) => row.lastAt < dormantBefore).length;
        const purchasesPerClient = clients.map((client) => ordered.get(client.id)?.purchases ?? 0);

        const joined = new Map(clients.map((client) => [client.id, client.createdAt]));
        const newBuyers = [...buyers.users].filter((id) => {
            const createdAt = joined.get(id);
            return createdAt != null && inRange(current, createdAt);
        }).length;

        return {
            period,
            from: current.from,
            to: current.to,
            bucketMs: current.bucketMs,
            trackingSince,
            totals: {
                clients: clients.length,
                newClients: { value: newCurrent, delta: computeDelta(newCurrent, newPrevious) },
                buyers: { value: buyers.total, delta: computeDelta(buyers.total, buyersPrev.total), newBuyers },
                visitors: { value: visitors.total, delta: computeDelta(visitors.total, visitorsPrev.total) },
                everOrdered: purchaseCounts.length,
                dormant,
            },
            growth: { newSeries, totalSeries },
            activity: { buyers: buyers.series, visitors: visitors.series },
            sources,
            platforms: VISIT_PLATFORMS.map((platform) => ({
                key: platform,
                users: platformUsers.get(platform)?.size ?? 0,
            })),
            devices: VISIT_DEVICES.map((device) => ({ key: device, users: deviceUsers.get(device)?.size ?? 0 })),
            visitFrequency: binCounts(
                FREQUENCY_BINS,
                [...visitDays.values()].map((days) => days.size),
            ),
            orderFrequency: binCounts(FREQUENCY_BINS, orderDaysByUser.values()),
            purchasesPerClient: binCounts(PURCHASE_BINS, purchasesPerClient),
            dormantAfterDays: DORMANT_AFTER_DAYS,
        };
    }
}
