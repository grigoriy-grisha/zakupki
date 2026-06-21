import { PackageIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';

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
            <StatCard
                icon={PackageIcon}
                value={itemsCount}
                label="Товаров"
                hint="в закупке"
            />
            <StatCard
                icon={ShoppingCartIcon}
                value={totalOrders}
                label="Заказов"
                hint="всего"
            />
            <StatCard
                icon={WalletIcon}
                value={`${totalDue.toLocaleString('ru-RU')} ₽`}
                label="К оплате"
            />
            <StatCard
                value={`${totalPaid.toLocaleString('ru-RU')} ₽`}
                label="Покрыто"
                accent={totalPaid >= totalDue && totalDue > 0 ? 'success' : 'neutral'}
                hint={totalDue > 0 ? `${Math.round((totalPaid / totalDue) * 100)}%` : undefined}
            />
            <StatCard
                value={`${remaining.toLocaleString('ru-RU')} ₽`}
                label="Осталось"
                accent={remaining > 0 ? 'warning' : 'success'}
            />
            <StatCard
                icon={UsersIcon}
                value={participantsCount}
                label="Участников"
                hint={totalPending > 0 ? `${totalPending.toLocaleString('ru-RU')} ₽ ждёт` : undefined}
            />
        </div>
    );
}
