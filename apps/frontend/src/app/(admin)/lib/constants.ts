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

export {
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_FULFILLMENT_STATUSES,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';

export const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Ожидает', className: 'bg-warning-50 text-warning hover:bg-warning-50' },
    CONFIRMED: { label: 'Подтверждено', className: 'bg-success-50 text-success hover:bg-success-50' },
    REJECTED: { label: 'Отклонено', className: 'bg-error-50 text-error hover:bg-error-50' },
};
