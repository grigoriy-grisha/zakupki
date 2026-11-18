import {
    CheckCircle2Icon,
    ChevronRightIcon,
    ClockIcon,
    CreditCardIcon,
    PackageCheckIcon,
    WalletIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { AppLink } from '@/components/app-link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { formatDaysAgo, formatRubShort, pluralize } from './format';
import type { DashboardSnapshot } from './types';

type AttentionItem = {
    key: string;
    icon: ComponentType<{ className?: string }>;
    tone: 'error' | 'warning' | 'info';
    title: string;
    hint?: string;
    href: string;
};

const TONE_CLASSES: Record<AttentionItem['tone'], string> = {
    error: 'bg-error-50 text-error',
    warning: 'bg-warning-50 text-warning',
    info: 'bg-secondary/10 text-secondary',
};

function topBy<T>(rows: readonly T[], value: (row: T) => number): T | undefined {
    return rows.reduce<T | undefined>((best, row) => (best && value(best) >= value(row) ? best : row), undefined);
}

function buildItems(snapshot: DashboardSnapshot): AttentionItem[] {
    const { attention, purchases, debt } = snapshot;
    const items: AttentionItem[] = [];

    if (attention.pendingManual.count > 0) {
        const target = topBy(
            purchases.filter((row) => row.pending > 0),
            (row) => row.pending,
        );
        const { count, oldestAt } = attention.pendingManual;
        items.push({
            key: 'pending-manual',
            icon: ClockIcon,
            tone: 'warning',
            title: `${count} ${pluralize(count, 'оплата ждёт', 'оплаты ждут', 'оплат ждут')} проверки`,
            hint: oldestAt ? `самая старая — ${formatDaysAgo(oldestAt)}` : undefined,
            href: target ? `/purchases/${target.id}` : '/purchases',
        });
    }

    if (attention.staleOnline > 0) {
        const count = attention.staleOnline;
        items.push({
            key: 'stale-online',
            icon: CreditCardIcon,
            tone: 'info',
            title: `${count} ${pluralize(count, 'онлайн-оплата', 'онлайн-оплаты', 'онлайн-оплат')} без ответа банка`,
            hint: 'больше часа в статусе «ожидает»',
            href: '/purchases',
        });
    }

    if (debt.total > 0) {
        const target = topBy(purchases, (row) => row.debt);
        items.push({
            key: 'debt',
            icon: WalletIcon,
            tone: 'error',
            title: `Долг ${formatRubShort(debt.total)}`,
            hint: `${debt.debtors} ${pluralize(debt.debtors, 'участник', 'участника', 'участников')} не доплатили`,
            href: target ? `/purchases/${target.id}` : '/purchases',
        });
    }

    if (attention.awaitingHandoff.count > 0) {
        const { count, purchases: purchaseCount } = attention.awaitingHandoff;
        const target = purchases.find((row) => row.fulfillmentStatus === 'READY_FOR_PICKUP');
        items.push({
            key: 'handoff',
            icon: PackageCheckIcon,
            tone: 'info',
            title: `${count} ${pluralize(count, 'заказ ждёт', 'заказа ждут', 'заказов ждут')} выдачи`,
            hint: `в ${purchaseCount} ${pluralize(purchaseCount, 'закупке', 'закупках', 'закупках')}`,
            href: purchaseCount === 1 && target ? `/purchases/${target.id}` : '/purchases',
        });
    }

    return items;
}

export function AttentionList({ snapshot }: { snapshot: DashboardSnapshot }) {
    const items = buildItems(snapshot);

    if (items.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-2xl bg-success-50 px-4 py-3 text-success">
                <CheckCircle2Icon className="size-5 shrink-0" />
                <span className="text-14-medium">Всё в порядке — срочных дел нет</span>
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-1">
            {items.map((item) => (
                <li key={item.key}>
                    <AppLink
                        href={item.href}
                        className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-bg-soft"
                    >
                        <span
                            className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-full',
                                TONE_CLASSES[item.tone],
                            )}
                        >
                            <item.icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-14-medium text-fg-primary">{item.title}</span>
                            {item.hint && (
                                <span className="truncate text-12-regular text-fg-tertiary">{item.hint}</span>
                            )}
                        </span>
                        <ChevronRightIcon className="size-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5" />
                    </AppLink>
                </li>
            ))}
        </ul>
    );
}

export function AttentionListSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
