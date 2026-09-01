import { PackageIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';
import { formatRub } from '@/lib/format/money';

interface PurchaseStatsProps {
    itemsCount: number;
    totalOrders: number;
    totalDue: number;
    totalPaid: number;
    totalPending: number;
    participantsCount: number;
}

export function PurchaseStats({
    itemsCount,
    totalOrders,
    totalDue,
    totalPaid,
    totalPending,
    participantsCount,
}: PurchaseStatsProps) {
    const remaining = Math.max(0, totalDue - totalPaid);
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={PackageIcon} value={itemsCount} label="Товаров" hint="в закупке" />
            <StatCard icon={ShoppingCartIcon} value={totalOrders} label="Заказов" hint="всего" />
            <StatCard icon={WalletIcon} value={`${formatRub(totalDue)}`} label="К оплате" />
            <StatCard
                value={`${formatRub(totalPaid)}`}
                label="Покрыто"
                accent={totalPaid >= totalDue && totalDue > 0 ? 'success' : 'neutral'}
                hint={totalDue > 0 ? `${Math.round((totalPaid / totalDue) * 100)}%` : undefined}
            />
            <StatCard
                value={`${formatRub(remaining)}`}
                label="Осталось"
                accent={remaining > 0 ? 'warning' : 'success'}
            />
            <StatCard
                icon={UsersIcon}
                value={participantsCount}
                label="Участников"
                hint={totalPending > 0 ? `${formatRub(totalPending)} ждёт` : undefined}
            />
        </div>
    );
}
