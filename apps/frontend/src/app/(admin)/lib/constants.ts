import { AlertCircle, Package, ShoppingCart, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активная',
    SUPPLEMENT: 'Добор',
    CLOSED: 'Закрыта',
    ARRIVED: 'Прибыла',
    DONE: 'Завершена',
};

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    DRAFT: 'secondary',
    ACTIVE: 'default',
    CLOSED: 'outline',
    ARRIVED: 'secondary',
    DONE: 'secondary',
};

export const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Ожидает', className: 'bg-warning-50 text-warning hover:bg-warning-50' },
    CONFIRMED: { label: 'Подтверждено', className: 'bg-success-50 text-success hover:bg-success-50' },
    REJECTED: { label: 'Отклонено', className: 'bg-error-50 text-error hover:bg-error-50' },
};

export const DASHBOARD_STATS: {
    title: string;
    value: string;
    icon: LucideIcon;
    change: string;
}[] = [
    { title: 'Активных закупок', value: '3', icon: ShoppingCart, change: '+1 за неделю' },
    { title: 'Участников', value: '24', icon: Users, change: '+5 за неделю' },
    { title: 'Товаров в каталоге', value: '156', icon: Package, change: '+12 за неделю' },
    { title: 'Ожидают оплаты', value: '8', icon: AlertCircle, change: 'На сумму 45 000 ₽' },
];

export const DASHBOARD_RECENT_ORDERS = [
    { id: 1, user: 'Анна К.', product: 'MIYUKI 11/0 Black', quantity: '50г', amount: '6 000 ₽', date: 'Вчера', status: 'new' },
    { id: 2, user: 'Мария С.', product: 'TOHO 15/0 Gold', quantity: '30г', amount: '5 400 ₽', date: 'Вчера', status: 'confirmed' },
    { id: 3, user: 'Елена П.', product: 'Чехия 2 мм Кристалл', quantity: '100 шт', amount: '2 500 ₽', date: '2 дня', status: 'paid' },
    { id: 4, user: 'Ольга В.', product: 'Нитка Fireline 4lb', quantity: '20 м', amount: '1 800 ₽', date: '3 дня', status: 'new' },
    { id: 5, user: 'Татьяна Р.', product: 'Мионо 0,3мм', quantity: '50 м', amount: '1 200 ₽', date: '4 дня', status: 'confirmed' },
] as const;

export const DASHBOARD_ORDER_STATUS_CONFIG: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
    new: { label: 'Новый', variant: 'default' },
    confirmed: { label: 'Подтверждён', variant: 'secondary' },
    paid: { label: 'Оплачен', variant: 'outline' },
};

export const DASHBOARD_RECENT_PURCHASES = [
    {
        id: 1,
        tag: '#СЗ7',
        title: 'Бисер MIYUKI',
        status: 'ACTIVE',
        deadline: '15 июня',
        progress: 85,
        items: 12,
        orders: 24,
        amount: '185 000 ₽',
        color: 'bg-claude-terracotta',
    },
    {
        id: 2,
        tag: '#СЗ8',
        title: 'Чешские кристаллы',
        status: 'ACTIVE',
        deadline: '20 июня',
        progress: 62,
        items: 8,
        orders: 18,
        amount: '92 000 ₽',
        color: 'bg-claude-purple',
    },
    {
        id: 3,
        tag: '#СЗ9',
        title: 'Нити и леска',
        status: 'DRAFT',
        deadline: '25 июня',
        progress: 0,
        items: 5,
        orders: 0,
        amount: '0 ₽',
        color: 'bg-muted-foreground/50',
    },
] as const;
