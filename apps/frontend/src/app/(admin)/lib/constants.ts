export const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активная',
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
    AWAITING: { label: 'Ждём оплату', className: 'bg-bg-soft text-fg-secondary hover:bg-bg-soft' },
};

/** Значок для строки возврата денег клиенту. */
export const REFUND_BADGE = { label: 'Возврат', className: 'bg-bg-soft text-fg-secondary hover:bg-bg-soft' };

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    MANUAL: 'Перевод',
    TBANK_CARD: 'Картой',
    TBANK_SBP: 'По СБП',
};

export const USER_ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Администратор',
    CLIENT: 'Клиент',
};
